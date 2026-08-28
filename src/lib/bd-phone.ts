// BD mobile validation shared by home checkout + every landing page.
export const PHONE_RE = /^01[3-9][0-9]{8}$/;
export const PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)";
export const PHONE_MAX_ERROR = "সর্বোচ্চ ১১ ডিজিটের নাম্বার দেওয়া যাবে";
// Blocks a 12th digit and reports the max-length error instead of silently ignoring it.
export function guardPhoneMaxDigits(e: { key: string; ctrlKey: boolean; metaKey: boolean; currentTarget: HTMLInputElement; preventDefault: () => void }, onError: (msg: string) => void): void {
  if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.metaKey) return;
  const el = e.currentTarget;
  const selected = (el.selectionEnd ?? 0) - (el.selectionStart ?? 0);
  const digits = (el.value || "").replace(/[^\d]/g, "").length;
  if (digits - selected >= 11) { e.preventDefault(); onError(PHONE_MAX_ERROR); }
}
export function normalizeBdPhone(v: string): string {
  const d = (v || "").replace(/[^\d]/g, "");
  return d.startsWith("8801") ? d.slice(2, 13) : d.slice(0, 11);
}
export function isValidBdPhone(v: string): boolean { return PHONE_RE.test(normalizeBdPhone(v)); }
export function phoneErrorFor(v: string): string { return !v || isValidBdPhone(v) ? "" : PHONE_ERROR; }
