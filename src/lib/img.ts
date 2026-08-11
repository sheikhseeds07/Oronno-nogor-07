// Supabase Storage on-the-fly image transformer → WebP + resize.
// Rewrites public object URLs to the render endpoint with width + format.
// Non-Supabase URLs and data: URIs pass through untouched.

export function toImg(
  url: string | null | undefined,
  opts: { w?: number; h?: number; q?: number } = {},
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  // Match Supabase storage public object URL → render/image equivalent
  // .../storage/v1/object/public/<bucket>/<path>
  const m = url.match(/^(https?:\/\/[^/]+\/storage\/v1)\/object\/(public|sign|authenticated)\/(.+)$/);
  if (!m) return url;

  const base = m[1];
  const rest = m[3];
  const params = new URLSearchParams();
  if (opts.w) params.set("width", String(opts.w));
  if (opts.h) params.set("height", String(opts.h));
  params.set("quality", String(opts.q ?? 75));
  params.set("format", "webp");
  params.set("resize", "cover");

  return `${base}/render/image/public/${rest}?${params.toString()}`;
}

// Build a srcset for responsive product images
export function imgSrcSet(url: string | null | undefined, widths: number[], q = 75): string {
  if (!url) return "";
  return widths
    .map((w) => `${toImg(url, { w, q })} ${w}w`)
    .join(", ");
}
