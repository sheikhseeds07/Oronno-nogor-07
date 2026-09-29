function envValue(name: string): string {
  try {
    return ((import.meta as unknown as { env?: Record<string, string> }).env?.[name] || "").trim();
  } catch {
    return "";
  }
}

const R2_PUBLIC_URL = envValue("VITE_R2_PUBLIC_URL").replace(/\/$/, "");

function unwrapMediaUrl(value: string): string {
  try {
    if (!value.startsWith("/media?")) return value;
    const parsed = new URL(value, "https://local.invalid");
    return parsed.searchParams.get("src") || value;
  } catch {
    return value;
  }
}

function productImagePath(value: string): string | null {
  const raw = unwrapMediaUrl(value);
  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/product-images\/(.+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function r2ProductUrl(value: string): string | null {
  if (!R2_PUBLIC_URL) return null;
  const path = productImagePath(value);
  if (!path) return null;
  return R2_PUBLIC_URL + "/product-images/" + path.split("/").map(encodeURIComponent).join("/");
}

function throughMediaCache(url: string): string {
  const r2 = r2ProductUrl(url);
  if (r2) return r2;

  const raw = unwrapMediaUrl(url);
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" && parsed.pathname.startsWith("/storage/v1/")) {
      return `/media?src=${encodeURIComponent(raw)}`;
    }
  } catch {}
  return url;
}

export function toImg(url: string | null | undefined, _opts: { w?: number; h?: number; q?: number } = {}): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return throughMediaCache(url);
}

export function imgSrcSet(url: string | null | undefined, widths: number[], _q = 75): string {
  if (!url || widths.length === 0) return "";
  const largest = Math.max(...widths);
  return `${toImg(url)} ${largest}w`;
}

export function imgFallback(e: { currentTarget: HTMLImageElement }, original: string | null | undefined) {
  const el = e.currentTarget;
  if (!original) return;
  const attempt = Number(el.dataset["imgRetry"] || "0");
  if (attempt >= 2) return;
  el.dataset["imgRetry"] = String(attempt + 1);
  el.removeAttribute("srcset");

  const primary = throughMediaCache(original);
  const raw = unwrapMediaUrl(original);
  const retryUrl = attempt === 0 ? primary : raw;
  window.setTimeout(() => {
    if (el.dataset["imgLoaded"] === "1") return;
    el.src = retryUrl;
  }, attempt === 0 ? 80 : 250);
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset["imgLoaded"] = "1";
}
