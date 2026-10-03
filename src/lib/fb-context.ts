// Tiny client-side helpers to gather Facebook ad attribution context
// (fbp / fbc cookies + current page URL) so the server can forward them
// to the Conversions API with Purchase events.

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, days = 90) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function ensureFbp(): string | null {
  const existing = readCookie("_fbp");
  if (existing) return existing;
  if (typeof document === "undefined") return null;
  // Format: fb.1.<ts_ms>.<random>
  const value = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
  writeCookie("_fbp", value);
  return value;
}

function ensureFbc(): string | null {
  const existing = readCookie("_fbc");
  if (typeof window === "undefined") return existing;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    // A fresh ad click must replace an older click id, otherwise Meta
    // attributes the purchase to a stale (often expired) click.
    if (!fbclid) return existing;
    if (existing && existing.endsWith(`.${fbclid}`)) return existing;
    // Format: fb.1.<ts_ms>.<fbclid>
    const value = `fb.1.${Date.now()}.${fbclid}`;
    writeCookie("_fbc", value);
    return value;
  } catch {
    return existing;
  }
}

export type FbContext = {
  fbp: string | null;
  fbc: string | null;
  source_url: string | null;
};

export function getFbContext(): FbContext {
  return {
    fbp: ensureFbp(),
    fbc: ensureFbc(),
    source_url: typeof window !== "undefined" ? window.location.href : null,
  };
}
