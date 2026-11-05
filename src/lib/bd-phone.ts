// BD mobile validation shared by home checkout + every landing page.
export const PHONE_RE = /^01[3-9][0-9]{8}$/;
export const PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)";
export const PHONE_MAX_ERROR = "সর্বোচ্চ ১১ ডিজিটের নাম্বার দেওয়া যাবে";
export function toAsciiDigits(v: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  return String(v ?? "").replace(/[০-৯]/g, (digit) => String(bn.indexOf(digit)));
}
export function digitsOf(v: string): string {
  const d = toAsciiDigits(v).replace(/[^\d]/g, "");
  return d.startsWith("8801") ? d.slice(2) : d;
}
// Normalize Bengali/English digits and common +880 formats to local 01XXXXXXXXX.
export function normalizeBdPhone(v: string): string {
  return digitsOf(v).slice(0, 11);
}
// Blocks a 12th digit and reports the max-length error instead of silently ignoring it.
export function guardPhoneMaxDigits(e: { key: string; ctrlKey: boolean; metaKey: boolean; currentTarget: HTMLInputElement; preventDefault: () => void }, onError: (msg: string) => void): void {
  if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.metaKey) return;
  const el = e.currentTarget;
  const selected = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
  const digits = digitsOf(el.value).length;
  if (digits - selected >= 11) { e.preventDefault(); onError(PHONE_MAX_ERROR); }
}
export function isValidBdPhone(v: string): boolean { return PHONE_RE.test(digitsOf(v)); }
// Error shown only when the user tries to submit.
export function phoneSubmitError(v: string): string {
  const d = digitsOf(v);
  if (PHONE_RE.test(d)) return "";
  return d.length > 11 ? PHONE_MAX_ERROR : PHONE_ERROR;
}
export function phoneErrorFor(v: string): string { return !v || isValidBdPhone(v) ? "" : PHONE_ERROR; }
