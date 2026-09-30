import { logger } from "@/lib/logger";
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
  // Landing pages receive ad bursts, so cache them briefly at the edge instead
  // of re-rendering and re-reading Postgres on every click.
  const isLanding = new URL(request.url).pathname.startsWith("/landing/");
  headers.set(
    "Cache-Control",
    isLanding
      ? "public, max-age=15, stale-while-revalidate=120, stale-if-error=86400"
      : "public, max-age=60, stale-while-revalidate=300, stale-if-error=86400",
  );
  headers.set(
    "Cloudflare-CDN-Cache-Control",
    isLanding
      ? "max-age=60, stale-while-revalidate=300, stale-if-error=86400"
      : "max-age=300, stale-while-revalidate=3600, stale-if-error=86400",
  );
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

  logger.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
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
    // Make Cloudflare bindings available to TanStack Start route handlers.
    // The Worker runtime supplies R2 bindings on the env object.
    (globalThis as typeof globalThis & { __ORONNO_CF_ENV?: unknown }).__ORONNO_CF_ENV = env;
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return addPublicEdgeCacheHeaders(request, normalized);
    } catch (error) {
      logger.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
