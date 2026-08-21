import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function isPublicCacheablePage(request: Request): boolean {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  const path = url.pathname;
  if (
    path.startsWith("/admin") ||
    path.startsWith("/api/") ||
    path === "/checkout" ||
    path === "/cart" ||
    path === "/login" ||
    path.startsWith("/order/") ||
    path.startsWith("/account")
  ) {
    return false;
  }

  // Never cache a request carrying credentials/cookies that could make the
  // SSR response user-specific.
  if (request.headers.has("authorization") || request.headers.has("cookie")) {
    return false;
  }

  return true;
}

function addPublicEdgeCacheHeaders(request: Request, response: Response): Response {
  if (!isPublicCacheablePage(request) || response.status !== 200) return response;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  // Public SSR pages can tolerate a short freshness window. Cloudflare can
  // serve stale content while revalidating, keeping repeat visits off origin.
  headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300, stale-if-error=86400");
  headers.set("Cloudflare-CDN-Cache-Control", "max-age=300, stale-while-revalidate=3600, stale-if-error=86400");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return addPublicEdgeCacheHeaders(request, normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
