import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupCustomerByPhone } from "./place-order.functions";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const LS_PHONE = "ss_last_phone";
const LS_NAME = "ss_last_name";
const LS_ADDR = "ss_last_address";

export function clearCheckoutSessionId(_expectedId?: string) {
  // Kept as a no-op for backwards compatibility with existing checkout callers.
}

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
  const { form, setForm } = params;
  const runLookup = useServerFn(lookupCustomerByPhone);
  const phone = form.phone;
  const phoneValid = PHONE_RE.test(phone);
  const lookupRef = useRef<string>("");
  const initRef = useRef(false);
  const [checkoutSessionId] = useState("");

  useEffect(() => {
    if (initRef.current || typeof window === "undefined") return;
    initRef.current = true;
    const savedPhoneRaw = localStorage.getItem(LS_PHONE) || "";
    const savedPhone = PHONE_RE.test(savedPhoneRaw) ? savedPhoneRaw : "";
    const savedName = localStorage.getItem(LS_NAME) || "";
    const savedAddr = localStorage.getItem(LS_ADDR) || "";
    if (savedPhone || savedName || savedAddr) {
      setForm((f) => ({ ...f, phone: f.phone || savedPhone, name: f.name || savedName, address: f.address || savedAddr }));
    }
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

  useEffect(() => {
    if (!phoneValid || typeof window === "undefined") return;
    localStorage.setItem(LS_PHONE, phone);
    if (form.name) localStorage.setItem(LS_NAME, form.name);
    if (form.address) localStorage.setItem(LS_ADDR, form.address);
  }, [phoneValid, phone, form.name, form.address]);

  return { checkoutSessionId };
}
