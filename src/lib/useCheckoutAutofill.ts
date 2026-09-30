import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupCustomerByPhone, saveIncompleteCheckout } from "./place-order.functions";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const LS_PHONE = "ss_last_phone";
const LS_NAME = "ss_last_name";
const LS_ADDR = "ss_last_address";

type Item = { id: string; name: string; price: number; quantity: number };

export function clearCheckoutSessionId(_expectedId?: string) {}

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
  const { form, setForm } = params;
  const runLookup = useServerFn(lookupCustomerByPhone);
  const saveIncomplete = useServerFn(saveIncompleteCheckout);
  const phone = form.phone.replace(/[\s-]/g, "");
  const phoneValid = PHONE_RE.test(phone);
  const lookupRef = useRef<string>("");
  const [checkoutSessionId] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedPhoneRaw = localStorage.getItem(LS_PHONE) || "";
    const savedPhone = PHONE_RE.test(savedPhoneRaw) ? savedPhoneRaw : "";
    const savedName = localStorage.getItem(LS_NAME) || "";
    const savedAddr = localStorage.getItem(LS_ADDR) || "";
    if (savedPhone || savedName || savedAddr) setForm((f) => ({ ...f, phone: f.phone || savedPhone, name: f.name || savedName, address: f.address || savedAddr }));
    if (savedPhone) {
      lookupRef.current = savedPhone;
      runLookup({ data: { phone: savedPhone } }).then((res) => {
        if (!res) return;
        setForm((f) => ({ ...f, name: f.name || (res.name ?? ""), address: f.address || (res.address ?? "") }));
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!phoneValid || lookupRef.current === phone) return;
    lookupRef.current = phone;
    runLookup({ data: { phone } }).then((res) => {
      if (!res) return;
      setForm((f) => ({ ...f, name: f.name || (res.name ?? ""), address: f.address || (res.address ?? "") }));
    }).catch(() => {});
  }, [phoneValid, phone, runLookup, setForm]);

  // The critical missing piece: as soon as a full 11-digit phone exists,
  // save the current checkout snapshot. This happens before Order Place,
  // so closing/navigating away leaves an Incomplete record.
  const itemsKey = JSON.stringify(params.items);
  useEffect(() => {
    if (!phoneValid || !params.items.length) return;
    const timer = window.setTimeout(() => {
      saveIncomplete({
        data: {
          customer_phone: phone,
          customer_name: form.name || null,
          customer_address: form.address || null,
          delivery_zone: params.zone || null,
          delivery_fee: Number(params.deliveryFee) || 0,
          subtotal: Number(params.subtotal) || 0,
          total: Number(params.total) || 0,
          note: form.note || null,
          items: params.items,
        },
      }).catch(() => {});
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [phoneValid, phone, form.name, form.address, form.note, params.zone, params.deliveryFee, params.subtotal, params.total, itemsKey, saveIncomplete]);

  useEffect(() => {
    if (!phoneValid || typeof window === "undefined") return;
    localStorage.setItem(LS_PHONE, phone);
    if (form.name) localStorage.setItem(LS_NAME, form.name);
    if (form.address) localStorage.setItem(LS_ADDR, form.address);
  }, [phoneValid, phone, form.name, form.address]);

  return { checkoutSessionId };
}
