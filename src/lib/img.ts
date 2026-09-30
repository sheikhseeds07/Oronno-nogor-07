import { legacyMediaKey, r2MediaUrl } from "./r2-media";

// An embedded, static image cannot start another network request on failure.
export const IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23f1f5f9'/%3E%3Cpath d='M120 148l25-30 19 21 17-15 25 24z' fill='%2394a3b8'/%3E%3Ccircle cx='184' cy='94' r='10' fill='%2394a3b8'/%3E%3C/svg%3E";
const MEDIA_ENDPOINT = import.meta.env.VITE_R2_PUBLIC_URL;

function resolveImage(value: string, depth = 0): string {
  if (depth > 3) return IMAGE_PLACEHOLDER;
  if (value.startsWith("data:image/") || value.startsWith("blob:")) return value;
  try {
    const url = new URL(value, "https://sheikhseeds.com");
    if (url.protocol !== "https:" && url.protocol !== "http:") return IMAGE_PLACEHOLDER;
    if (url.username || url.password) return IMAGE_PLACEHOLDER;
    if (url.origin === "https://sheikhseeds.com" && url.pathname === "/media") {
      const asset = url.searchParams.get("asset");
      if (asset) return r2MediaUrl(asset, MEDIA_ENDPOINT) ?? IMAGE_PLACEHOLDER;
      const source = url.searchParams.get("src");
      return source ? resolveImage(source, depth + 1) : IMAGE_PLACEHOLDER;
    }
    const legacy = legacyMediaKey(url.toString());
    if (legacy) return r2MediaUrl(legacy, MEDIA_ENDPOINT) ?? IMAGE_PLACEHOLDER;
    if (/(?:^|\.)supabase\.(?:co|in)$/i.test(url.hostname) || url.pathname.startsWith("/storage/v1/")) return IMAGE_PLACEHOLDER;
    if (/(?:^|\.)r2\.cloudflarestorage\.com$/i.test(url.hostname)) return IMAGE_PLACEHOLDER;
    if (value.startsWith("//")) return url.toString();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return `${url.pathname}${url.search}${url.hash}`;
    return url.toString();
  } catch { return IMAGE_PLACEHOLDER; }
}

export function toImg(url: string | null | undefined, _opts: { w?: number; h?: number; q?: number } = {}): string {
  return typeof url === "string" && url.trim() ? resolveImage(url.trim()) : IMAGE_PLACEHOLDER;
}

export function imgSrcSet(url: string | null | undefined, widths: number[], _q = 75): string {
  if (!url || widths.length === 0) return "";
  const source = toImg(url);
  return source === IMAGE_PLACEHOLDER ? "" : `${source} ${Math.max(...widths)}w`;
}

export function safeImageSrcSet(value: string | undefined): string | undefined {
  if (!value || value.includes("data:")) return undefined;
  const candidates = value.split(",").map(candidate => {
    const [source, descriptor, ...extra] = candidate.trim().split(/\s+/);
    if (!source || extra.length || (descriptor && !/^(?:\d+w|\d+(?:\.\d+)?x)$/.test(descriptor))) return "";
    const normalized = toImg(source);
    return normalized === IMAGE_PLACEHOLDER ? "" : `${normalized}${descriptor ? ` ${descriptor}` : ""}`;
  }).filter(Boolean);
  return candidates.length ? candidates.join(", ") : undefined;
}

// Compatibility for callers outside SafeImage: one failure, no retry/timer.
export function imgFallback(e: { currentTarget: HTMLImageElement }, _original?: string | null) {
  const el = e.currentTarget;
  if (el.dataset.imgFailed === "1") return;
  el.dataset.imgFailed = "1";
  el.removeAttribute("srcset");
  el.src = IMAGE_PLACEHOLDER;
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset.imgLoaded = "1";
}
