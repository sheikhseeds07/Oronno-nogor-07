import os, re

BD = '''// Single source of truth for Bangladeshi 11-digit mobile validation.
// Home checkout + every landing page (current and future) share these rules.
export const PHONE_RE = /^01[3-9][0-9]{8}$/;
export const PHONE_ERROR = "\u0938\u09a0\u09bf\u0995 \u09e7\u09e7 \u09a1\u09bf\u099c\u09bf\u099f\u09c7\u09b0 \u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6\u09bf \u09ae\u09cb\u09ac\u09be\u0987\u09b2 \u09a8\u09be\u09ae\u09cd\u09ac\u09be\u09b0 \u09a6\u09bf\u09a8 (01XXXXXXXXX)";

export function normalizeBdPhone(value: string): string {
  const digits = (value || "").replace(/[^\\d]/g, "");
  if (digits.startsWith("8801")) return digits.slice(2, 13);
  return digits.slice(0, 11);
}

export function isValidBdPhone(value: string): boolean {
  return PHONE_RE.test(normalizeBdPhone(value));
}

export function phoneErrorFor(value: string): string {
  if (!value) return "";
  return isValidBdPhone(value) ? "" : PHONE_ERROR;
}
'''
os.makedirs("src/lib", exist_ok=True)
open("src/lib/bd-phone.ts", "w").write(BD)

def add_import(s):
    lines = s.split("\n")
    last = max(i for i, l in enumerate(lines) if l.startswith("import"))
    lines.insert(last + 1, 'import { isValidBdPhone, phoneErrorFor, PHONE_ERROR } from "@/lib/bd-phone";')
    return "\n".join(lines)

# ---------- shared checkout card (Legacy / Professional / ProductStyle + future pages) ----------
p = "src/components/landing/lp-shared.tsx"
s = open(p).read()
assert "phoneErr" not in s, "lp-shared already patched"
old_sig = '}) {\n  const themeBg10 = themeColor + "1A";\n  const inputCls = "w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition";\n  return <div className="lp-product-checkout-group"><div className="lp-checkout-shell rounded-2xl bg-white overflow-hidden">\n    <form id={formId} onSubmit={onSubmit} className="p-3 sm:p-4 space-y-3">'
assert old_sig in s
new_sig = '''}) {
  const themeBg10 = themeColor + "1A";
  const inputCls = "w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition";
  const [phoneErr, setPhoneErr] = useState("");
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const phoneValid = isValidBdPhone(values.phone);
  const phoneInputCls = `w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none transition ${phoneErr ? "border-red-500 bg-red-50/60 focus:border-red-500" : "border-slate-200 bg-slate-50/60 focus:bg-white focus:border-emerald-500"}`;
  const guardedSubmit = (e: React.FormEvent) => {
    if (!phoneValid) {
      e.preventDefault();
      setPhoneErr(PHONE_ERROR);
      phoneRef.current?.focus();
      phoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPhoneErr("");
    onSubmit(e);
  };
  return <div className="lp-product-checkout-group"><div className="lp-checkout-shell rounded-2xl bg-white overflow-hidden">
    <form id={formId} onSubmit={guardedSubmit} className="p-3 sm:p-4 space-y-3">'''
s = s.replace(old_sig, new_sig, 1)
old_phone = '<input required type="tel" value={values.phone} onChange={e => onChange("phone", e.target.value)} placeholder="01XXXXXXXXX" className={inputCls} /></div></div>'
assert old_phone in s
new_phone = '<input ref={phoneRef} required type="tel" inputMode="numeric" maxLength={11} value={values.phone} onChange={e => { const v = e.target.value.replace(/[^\\d]/g, "").slice(0, 11); onChange("phone", v); setPhoneErr(phoneErrorFor(v)); }} onBlur={() => setPhoneErr(phoneErrorFor(values.phone))} aria-invalid={Boolean(values.phone) && !phoneValid} placeholder="01XXXXXXXXX" className={phoneInputCls} /></div>{phoneErr && <p className="mt-1 text-[12px] font-medium text-red-600">{phoneErr}</p>}</div>'
s = s.replace(old_pÿone, new_phone, 1)