// Browser-side rewrite: anonymous catalog reads go through the same-origin
// Cloudflare-cached proxy (/api/public/pg) instead of hitting Supabase REST on
// every page view. Logged-in staff traffic and every write stay untouched.

const PUBLIC_TABLES = new Set([
  "products",
  "categories",
  "banners",
  "site_settings",
  "landing_pages",
  "reviews",
  "product_reviews",
  "blog_posts",
  "faqs",
  "testimonials",
]);

const PUBLIC_RPCS = new Set(["get_home_data_v1"]);

const MAX_PROXY_URL_LENGTH = 1800;

function pathIsPublic(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/rest/v1/")) return false;
  const head = pathname.slice("/rest/v1/".length);
  if (head.startsWith("rpc/")) return method === "POST" && PUBLIC_RPCS.has(head.slice(4));
  return method === "GET" && PUBLIC_TABLES.has(head);
}

// Server-side (SSR / server function) equivalent: the same anonymous reads are
// pulled through the Cloudflare edge cache instead of Supabase on every render.
export function isPublicAnonRead(
  rawUrl: string,
  supabaseUrl: string,
  method: string,
  hasUserToken: boolean,
): boolean {
  if (hasUserToken) return false;
  try {
    const target = new URL(rawUrl, supabaseUrl);
    if (target.origin !== new URL(supabaseUrl).origin) return false;
    return pathIsPublic(target.pathname, method);
  } catch {
    return false;
  }
}

export function publicReadProxyUrl(
  rawUrl: string,
  supabaseUrl: string,
  method: string,
  body: string | undefined,
  hasUserToken: boolean,
): string | null {
  if (typeof window === "undefined" || hasUserToken) return null;
  let target: URL;
  try {
    target = new URL(rawUrl, supabaseUrl);
  } catch {
    return null;
  }
  if (target.origin !== new URL(supabaseUrl).origin) return null;
  if (!pathIsPublic(target.pathname, method)) return null;
  if (method === "POST" && body && body.length > 500) return null;

  const proxy = new URL("/api/public/pg", window.location.origin);
  proxy.searchParams.set("path", target.pathname + target.search);
  if (target.pathname === "/rest/v1/landing_pages") proxy.searchParams.set("v", "landing-v3");
  if (method !== "GET") proxy.searchParams.set("m", method);
  if (method === "POST" && body) proxy.searchParams.set("b", body);
  const href = proxy.toString();
  return href.length > MAX_PROXY_URL_LENGTH ? null : href;
}
