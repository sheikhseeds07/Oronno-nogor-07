import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { upsertIncompleteOrder, lookupCustomerByPhone } from "./incomplete-order.functions";

const PHONE_RE = /^(?:\+?88)?01[0-9]{9}$/;
const normalizePhone = (value: string) => {
  const clean = value.replace(/[\s-]/g, "");
  if (clean.startsWith("+8801")) return `0${clean.slice(4)}`;
  if (clean.startsWith("8801")) return `0${clean.slice(3)}`;
  return clean;
};
const LS_PHONE = "ss_last_phone";
const LS_NAME = "ss_last_name";
const LS_ADDR = "ss_last_address";

type Item = { id: string; name: string; price: number; quantity: number };

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

  const phoneNorm = normalizePhone(form.phone);
  const phoneValid = PHONE_RE.test(phoneNorm);
  const lookupRef = useRef<string>("");
  const lastSavedRef = useRef<string>("");
  const initRef = useRef(false);

  // On mount: hydrate from localStorage, then lookup
  useEffect(() => {
    if (initRef.current || typeof window === "undefined") return;
    initRef.current = true;
    const savedPhone = localStorage.getItem(LS_PHONE) || "";
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
    if (savedPhone && PHONE_RE.test(savedPhone)) {
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

  // Lookup when user types a valid phone
  useEffect(() => {
    if (!phoneValid || lookupRef.current === phoneNorm) return;
    lookupRef.current = phoneNorm;
    runLookup({ data: { phone: phoneNorm } })
      .then((res) => {
        if (!res) return;
        setForm((f) => ({
          ...f,
          name: f.name || (res.name ?? ""),
          address: f.address || (res.address ?? ""),
        }));
      })
      .catch(() => {});
  }, [phoneValid, phoneNorm, runLookup, setForm]);

  // Persist phone immediately when it becomes valid (even before cart)
  useEffect(() => {
    if (!phoneValid || typeof window === "undefined") return;
    localStorage.setItem(LS_PHONE, phoneNorm);
    if (form.name) localStorage.setItem(LS_NAME, form.name);
    if (form.address) localStorage.setItem(LS_ADDR, form.address);
  }, [phoneValid, phoneNorm, form.name, form.address]);

  // Save incomplete order as soon as the phone is valid, then keep updating as details change.
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    if (!enableSave || !phoneValid || items.length === 0) return;
    const payload = {
      phone: phoneNorm,
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
  }, [enableSave, phoneValid, phoneNorm, form.name, form.address, form.note, itemsKey, subtotal, total, deliveryFee, zone]);
}
