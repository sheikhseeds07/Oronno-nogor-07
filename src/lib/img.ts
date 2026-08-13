// Supabase Storage on-the-fly image transformer → WebP + resize.
// Rewrites public object URLs to the render endpoint with width + format.
// Non-Supabase URLs and data: URIs pass through untouched.

export function toImg(
  url: string | null | undefined,
  opts: { w?: number; h?: number; q?: number } = {},
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  // Match Supabase storage object URL → render/image equivalent.
  // Keep the access kind (public / sign / authenticated) and any existing
  // query string (signed URLs carry a ?token=... that must be preserved).
  const m = url.match(/^(https?:\/\/[^/]+\/storage\/v1)\/object\/(public|sign|authenticated)\/([^?]+)(\?.*)?$/);
  if (!m) return url;

  const base = m[1];
  const kind = m[2];
  const rest = m[3];
  const params = new URLSearchParams(m[4] ? m[4].slice(1) : "");
  if (opts.w) params.set("width", String(opts.w));
  if (opts.h) params.set("height", String(opts.h));
  params.set("quality", String(opts.q ?? 75));
  params.set("format", "webp");
  params.set("resize", "cover");

  return `${base}/render/image/${kind}/${rest}?${params.toString()}`;
}


// Build a srcset for responsive product images
export function imgSrcSet(url: string | null | undefined, widths: number[], q = 75): string {
  if (!url) return "";
  return widths
    .map((w) => `${toImg(url, { w, q })} ${w}w`)
    .join(", ");
}

// If the transform endpoint can't serve an image (e.g. image transformation
// disabled, or a signed URL it won't render), fall back to the raw object URL
// once so the picture still shows up.
export function imgFallback(
  e: { currentTarget: HTMLImageElement },
  original: string | null | undefined,
) {
  const el = e.currentTarget;
  if (!original || el.dataset["fallback"] === "1") return;
  el.dataset["fallback"] = "1";
  el.removeAttribute("srcset");
  el.src = original;
}
