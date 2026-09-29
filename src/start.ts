import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/lib/personal-supabase/auth-attacher";

const NO_STORE = "private, no-store";
const PUBLIC_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const LANDING_CACHE = "public, max-age=15, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "Cache-Control": NO_STORE,
        "CDN-Cache-Control": NO_STORE,
        "Cloudflare-CDN-Cache-Control": NO_STORE,
      },
    });
  }
});

// Only anonymous public GET pages may be cached at the edge. The /media route
// owns its own public/private cache policy and must not be overwritten here.
// Everything that can contain orders, auth, checkout, account, admin or API
// data remains no-store.
const dynamicCacheMiddleware = createMiddleware().server(async ({ request, next }) => {
  const result = await next();
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  // /media validates the Supabase Storage bucket itself and sets the correct
  // cache headers. Let those headers reach Cloudflare unchanged so the /media
  // Cache Rule can actually cache public image responses at the edge.
  if (pathname === "/media" || pathname === "/api/public/pg") {
    return result;
  }

  const hasAuth = Boolean(request.headers.get("authorization"));
  // Only a real session cookie makes a page personal. Analytics/preference
  // cookies used to disable edge caching for almost every returning visitor,
  // which meant every visit re-rendered on the server and re-read the database.
  const cookieHeader = request.headers.get("cookie") || "";
  const hasSessionCookie = /(^|;\s*)sb-[^=]*auth-token/i.test(cookieHeader);
  const isPublicPage =
    method === "GET" &&
    (pathname === "/" ||
      pathname.startsWith("/landing/") ||
      pathname.startsWith("/product/") ||
      pathname.startsWith("/category/"));

  // Landing pages get a short edge TTL: ad traffic is served from Cloudflare,
  // while admin edits still propagate within about a minute.
  const isLandingPage = method === "GET" && pathname.startsWith("/landing/");

  if (isLandingPage && !hasAuth && !hasSessionCookie) {
    result.response.headers.set("Cache-Control", LANDING_CACHE);
    result.response.headers.set("CDN-Cache-Control", LANDING_CACHE);
    result.response.headers.set("Cloudflare-CDN-Cache-Control", LANDING_CACHE);
  } else if (isPublicPage && !hasAuth && !hasSessionCookie) {
    result.response.headers.set("Cache-Control", PUBLIC_CACHE);
    result.response.headers.set("CDN-Cache-Control", PUBLIC_CACHE);
    result.response.headers.set("Cloudflare-CDN-Cache-Control", PUBLIC_CACHE);
  } else {
    result.response.headers.set("Cache-Control", NO_STORE);
    result.response.headers.set("CDN-Cache-Control", NO_STORE);
    result.response.headers.set("Cloudflare-CDN-Cache-Control", NO_STORE);
  }

  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, dynamicCacheMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
