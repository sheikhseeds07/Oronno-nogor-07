import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/lib/personal-supabase/auth-attacher";

const NO_STORE = "private, no-store";

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

// Workers Caching is enabled at the Cloudflare Worker level so /media can be
// served from Cloudflare before this application runs. Every other dynamic
// route is explicitly no-store so orders, admin, auth, courier and API output
// can never be cached or mixed between users.
const dynamicNoStoreMiddleware = createMiddleware().server(async ({ request, next }) => {
  const result = await next();
  const pathname = new URL(request.url).pathname;

  if (pathname !== "/media") {
    result.response.headers.set("Cache-Control", NO_STORE);
    result.response.headers.set("CDN-Cache-Control", NO_STORE);
    result.response.headers.set("Cloudflare-CDN-Cache-Control", NO_STORE);
  }

  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, dynamicNoStoreMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
