// BD mobile validation shared by home checkout + every landing page.
export const PHONE_RE = /^01[3-9][0-9]{8}$/;
export const PHONE_ERROR = "সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX)";
export function normalizeBdPhone(v: string): string {
  const d = (v || "").replace(/[^\d]/g, "");
  return d.startsWith("8801") ? d.slice(2, 13) : d.slice(0, 11);
}
export function isValidBdPhone(v: string): boolean { return PHONE_RE.test(normalizeBdPhone(v)); }
export function phoneErrorFor(v: string): string { return !v || isValidBdPhone(v) ? "" : PHONE_ERROR; }
