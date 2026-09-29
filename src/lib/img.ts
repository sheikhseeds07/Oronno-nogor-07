const R2_PUBLIC_BASE = "https://images.sheikhseeds.com";
const SUPABASE_STORAGE_HOSTS = new Set([
  "bvuhvzccziuniujeogng.supabase.co",
  "frtzlibogmethppqmhtr.supabase.co",
  "yqhtenonavuzxzemaiyk.supabase.co",
]);

function unwrapMediaCache(url: string): string {
  try {
    const parsed = new URL(url, "https://sheikhseeds.com");
    if (parsed.pathname === "/media") {
      const src = parsed.searchParams.get("src");
      if (src) return src;
    }
  } catch {}
  return url;
}

function legacySupabaseToR2(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!SUPABASE_STORAGE_HOSTS.has(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const bucket = match[1];
    const objectPath = match[2]
      .split("/")
      .map((part) => encodeURIComponent(decodeURIComponent(part)))
      .join("/");
    return `${R2_PUBLIC_BASE}/${encodeURIComponent(bucket)}/${objectPath}`;
  } catch {
    return null;
  }
}

export function toImg(url: string | null | undefined, _opts: { w?: number; h?: number; q?: number } = {}): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/placeholder")) return url;
  const source = unwrapMediaCache(url);
  return legacySupabaseToR2(source) || source;
}

export function imgSrcSet(url: string | null | undefined, widths: number[], _q = 75): string {
  if (!url || widths.length === 0) return "";
  const source = toImg(url);
  const largest = Math.max(...widths);
  return source ? `${source} ${largest}w` : "";
}

export function imgFallback(e: { currentTarget: HTMLImageElement }, original: string | null | undefined) {
  const el = e.currentTarget;
  if (el.dataset["imgRetry"] === "1") return;
  el.dataset["imgRetry"] = "1";
  el.removeAttribute("srcset");
  const r2 = original ? toImg(original) : "";
  el.src = r2 && el.src !== new URL(r2, window.location.origin).href ? r2 : "/placeholder.svg";
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset["imgLoaded"] = "1";
}
