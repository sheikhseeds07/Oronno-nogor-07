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

export type MarketingSource = "facebook_ads" | "tiktok_ads" | "organic" | "direct" | "unknown";

function classifyMarketingUrl(rawUrl: string): MarketingSource | null {
  try {
    const url = new URL(rawUrl);
    const params = url.searchParams;
    const utm = (params.get("utm_source") || "").trim().toLowerCase();
    // Click IDs and explicit platform UTMs identify paid social traffic.
    if (params.has("fbclid") || ["facebook", "facebook_ads", "meta", "meta_ads", "instagram", "instagram_ads", "fb", "ig"].includes(utm)) return "facebook_ads";
    if (params.has("ttclid") || ["tiktok", "tiktok_ads", "tt"].includes(utm)) return "tiktok_ads";
    if (["google", "bing", "yahoo", "duckduckgo"].includes(utm)) return "organic";
    const host = url.hostname.toLowerCase();
    if (/(^|\\.)((facebook|fb|instagram)\\.com|fb\\.me)$/.test(host)) return "facebook_ads";
    if (/(^|\\.)tiktok\\.com$/.test(host)) return "tiktok_ads";
    if (/(^|\\.)(google|bing|yahoo|duckduckgo)\\./.test(host)) return "organic";
  } catch { /* Ignore malformed URLs. */ }
  return null;
}

function readMarketingSourceFromUrl(): MarketingSource | null {
  if (typeof window === "undefined") return null;
  return classifyMarketingUrl(window.location.href)
    ?? (document.referrer ? classifyMarketingUrl(document.referrer) : null);
}

export function captureMarketingSource(): MarketingSource {
  if (typeof window === "undefined") return "unknown";
  const fromUrl = readMarketingSourceFromUrl();
  // A fresh landing URL wins over every older click cookie.
  if (fromUrl) {
    writeCookie("_oronno_marketing_source", fromUrl);
    return fromUrl;
  }
  // Keep the latest known source across navigation; never let an older
  // platform click cookie override a more recent TikTok/Facebook visit.
  const saved = readCookie("_oronno_marketing_source") as MarketingSource | null;
  if (saved && ["facebook_ads", "tiktok_ads", "organic", "direct"].includes(saved)) return saved;
  // Click-id cookies are a fallback only. The saved source represents the
  // most recent classified visit and must win over stale cookies from another ad network.
  if (readCookie("_ttclid")) return "tiktok_ads";
  if (readCookie("_fbc")) return "facebook_ads";
  return "unknown";
}

export type FbContext = {
  fbp: string | null;
  fbc: string | null;
  source_url: string | null;
  marketing_source: MarketingSource;
};

export function getFbContext(): FbContext {
  return {
    fbp: ensureFbp(),
    fbc: ensureFbc(),
    source_url: typeof window !== "undefined" ? window.location.href : null,
    marketing_source: captureMarketingSource(),
  };
}
