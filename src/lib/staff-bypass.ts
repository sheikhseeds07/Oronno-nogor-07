/**
 * Owner / staff bypass for the site-wide block screen.
 *
 * The block screen exists for blocked customers only. An owner, admin or
 * employee device must never be locked out — not by IP, not by device and not
 * because a blocked customer once used the same phone. Once a staff session is
 * confirmed we remember it in a long-lived cookie (readable during SSR, so the
 * block screen never renders even for a moment) plus localStorage.
 */
export const STAFF_BYPASS_COOKIE = "ss_staff_pass";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function markStaffBypass() {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${STAFF_BYPASS_COOKIE}=1; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    localStorage.setItem(STAFF_BYPASS_COOKIE, "1");
  } catch {
    /* storage unavailable */
  }
}

export function hasStaffBypass(): boolean {
  if (typeof document === "undefined") return false;
  try {
    if (localStorage.getItem(STAFF_BYPASS_COOKIE) === "1") return true;
  } catch {
    /* storage unavailable */
  }
  return document.cookie.split(";").some((c) => c.trim() === `${STAFF_BYPASS_COOKIE}=1`);
}

/** True when the incoming request carries the staff bypass cookie. */
export function requestHasStaffBypass(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((c) => c.trim() === `${STAFF_BYPASS_COOKIE}=1`);
}
