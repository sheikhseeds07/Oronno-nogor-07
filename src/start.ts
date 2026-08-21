import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/lib/personal-supabase/auth-attacher";

const NO_STORE = "private, no-store";
const PUBLIC_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

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

// Only anonymous public GET pages may be cached at the edge. Everything that
// can contain orders, auth, checkout, account, admin or API data is no-store.
const dynamicCacheMiddleware = createMiddleware().server(async ({ request, next }) => {
  const result = await next();
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();
  const hasAuth = Boolean(request.headers.get("authorization"));
  const hasCookie = Boolean(request.headers.get("cookie"));
  const isPublicPage = method === "GET" && (pathname === "/" || pathname.startsWith("/landing/"));

  if (isPublicPage && !hasAuth && !hasCookie) {
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
