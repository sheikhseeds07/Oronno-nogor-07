import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { upsertIncompleteOrder, lookupCustomerByPhone } from "./incomplete-order.functions";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const LS_PHONE = "ss_last_phone";
const LS_NAME = "ss_last_name";
const LS_ADDR = "ss_last_address";
const LS_CHECKOUT_SESSION = "ss_checkout_session_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Item = { id: string; name: string; price: number; quantity: number };

function getOrCreateCheckoutSessionId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(LS_CHECKOUT_SESSION) || "";
  if (UUID_RE.test(existing)) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(LS_CHECKOUT_SESSION, id);
  return localStorage.getItem(LS_CHECKOUT_SESSION) || id;
}

export function clearCheckoutSessionId(expectedId?: string) {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem(LS_CHECKOUT_SESSION);
  if (!expectedId || !current || current === expectedId) {
    localStorage.removeItem(LS_CHECKOUT_SESSION);
  }
}

export function useCheckoutAutofill(params: {
  form: { name: string; phone: string; address: string; note?: string };
  setForm: (updater: (f: { name: string; phone: string; address: string; note?: string; [k: string]: unknown }) => typeof params.form) => void;
  items: Item[];
  subtotal: number;
  total: number;
  deliveryFee: number;
  zone?: string;
  enableSave?: boolean;
}) {
  const { form, setForm, items, subtotal, total, deliveryFee, zone, enableSave = true } = params;
  const runLookup = useServerFn(lookupCustomerByPhone);
  const runUpsert = useServerFn(upsertIncompleteOrder);

  const phone = form.phone;
  const phoneValid = PHONE_RE.test(phone);
  const lookupRef = useRef<string>("");
  const lastSavedRef = useRef<string>("");
  const initRef = useRef(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState("");

  // On mount: create/reuse a stable checkout id, hydrate saved customer data, then lookup.
  useEffect(() => {
    if (initRef.current || typeof window === "undefined") return;
    initRef.current = true;
    setCheckoutSessionId(getOrCreateCheckoutSessionId());

    const savedPhoneRaw = localStorage.getItem(LS_PHONE) || "";
    const savedPhone = PHONE_RE.test(savedPhoneRaw) ? savedPhoneRaw : "";
    const savedName = localStorage.getItem(LS_NAME) || "";
    const savedAddr = localStorage.getItem(LS_ADDR) || "";
    if (savedPhone || savedName || savedAddr) {
      setForm((f) => ({
        ...f,
        phone: f.phone || savedPhone,
        name: f.name || savedName,
        address: f.address || savedAddr,
      }));
    }
    if (savedPhone) {
      lookupRef.current = savedPhone;
      runLookup({ data: { phone: savedPhone } })
        .then((res) => {
          if (!res) return;
          setForm((f) => ({
            ...f,
            name: f.name || (res.name ?? ""),
            address: f.address || (res.address ?? ""),
          }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lookup when user types an exact valid Bangladesh mobile number.
  useEffect(() => {
    if (!phoneValid || lookupRef.current === phone) return;
    lookupRef.current = phone;
    runLookup({ data: { phone } })
      .then((res) => {
        if (!res) return;
        setForm((f) => ({
          ...f,
          name: f.name || (res.name ?? ""),
          address: f.address || (res.address ?? ""),
        }));
      })
      .catch(() => {});
  }, [phoneValid, phone, runLookup, setForm]);

  // Persist only strict 11-digit local-format phone numbers.
  useEffect(() => {
    if (!phoneValid || typeof window === "undefined") return;
    localStorage.setItem(LS_PHONE, phone);
    if (form.name) localStorage.setItem(LS_NAME, form.name);
    if (form.address) localStorage.setItem(LS_ADDR, form.address);
  }, [phoneValid, phone, form.name, form.address]);

  // One checkout/session = one draft. Phone/name/address/cart changes update this row.
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    if (!enableSave || !checkoutSessionId || !phoneValid || items.length === 0) return;
    const payload = {
      checkout_session_id: checkoutSessionId,
      phone,
      customer_name: form.name || null,
      customer_address: form.address || null,
      delivery_zone: zone || null,
      delivery_fee: deliveryFee,
      items,
      subtotal,
      total,
      note: form.note || null,
    };
    const saveKey = JSON.stringify(payload);
    if (lastSavedRef.current === saveKey) return;
    const t = setTimeout(() => {
      runUpsert({ data: payload })
        .then(() => { lastSavedRef.current = saveKey; })
        .catch((error) => console.error("Incomplete order save failed", error));
    }, form.name || form.address || form.note ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableSave, checkoutSessionId, phoneValid, phone, form.name, form.address, form.note, itemsKey, subtotal, total, deliveryFee, zone]);

  return { checkoutSessionId };
}
