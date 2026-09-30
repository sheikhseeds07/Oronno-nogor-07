export function validateR2PublicUrl(value: string | undefined): string {
  const endpoint = value?.trim();
  if (!endpoint) {
    throw new Error("R2_PUBLIC_URL is required at build time. Set R2_PUBLIC_URL=/media for the MEDIA_BUCKET Worker binding.");
  }
  if (endpoint === "/media") return endpoint;
  let url: URL;
  try { url = new URL(endpoint); } catch {
    throw new Error("R2_PUBLIC_URL must be /media or an HTTPS public R2 media URL.");
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    /(?:^|\.)supabase\.(?:co|in)$/i.test(url.hostname) ||
    /(?:^|\.)r2\.cloudflarestorage\.com$/i.test(url.hostname) ||
    /^(?:www\.)?sheikhseeds\.com$/i.test(url.hostname)
  ) {
    throw new Error("R2_PUBLIC_URL must use the public media endpoint; use /media for this site's R2 binding.");
  }
  return url.toString().replace(/\/+$/, "");
}
