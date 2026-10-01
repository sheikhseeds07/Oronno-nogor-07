import { retiredStorageResponse } from "@/lib/retired-storage";
// The shop's production data now lives in the restored Supabase project.
// Keep this wrapper independent from workspace-injected VITE_* values so a stale
// deployment variable cannot silently point the storefront at a different DB.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db.types";
import { publicReadProxyUrl, isPublicAnonRead } from "@/integrations/supabase/public-read-proxy";

export type TypedSupabaseClient = SupabaseClient<Database>;

export const LIVE_DATABASE_URL = "https://frtzlibogmethppqmhtr.supabase.co";
export const LIVE_DATABASE_KEY = "sb_publishable_IwyqncvDdP4OF2UDNMlK9g_bn6Hu6n1";

async function liveFetch(input: RequestInfo | URL, init?: RequestInit) {
  const retired = retiredStorageResponse(input);
  if (retired) return retired;
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (headers.get("Authorization") === `Bearer ${LIVE_DATABASE_KEY}`) headers.delete("Authorization");
  headers.set("apikey", LIVE_DATABASE_KEY);

  const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const auth = headers.get("Authorization");
  const hasUserToken = Boolean(auth && auth !== `Bearer ${LIVE_DATABASE_KEY}`);
  const bodyText = typeof init?.body === "string" ? init.body : undefined;

  const proxied = publicReadProxyUrl(rawUrl, LIVE_DATABASE_URL, method, bodyText, hasUserToken);
  if (proxied) {
    const proxyHeaders = new Headers();
    const accept = headers.get("Accept");
    if (accept) proxyHeaders.set("Accept", accept);
    const range = headers.get("Range");
    if (range) proxyHeaders.set("Range", range);
    return fetch(proxied, { method: "GET", headers: proxyHeaders, signal: init?.signal ?? (input instanceof Request ? input.signal : undefined) });
  }

  if (typeof window === "undefined" && isPublicAnonRead(rawUrl, LIVE_DATABASE_URL, method, hasUserToken)) {
    const isLandingRead = new URL(rawUrl).pathname === "/rest/v1/landing_pages";
    const cacheTtl = isLandingRead ? 10 : 3600;
    const cacheKey = isLandingRead ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}__cache_v=landing-v2` : undefined;
    return fetch(input, { ...init, headers, cf: { cacheEverything: true, cacheTtl, ...(cacheKey ? { cacheKey } : {}) } } as RequestInit);
  }

  return fetch(input, { ...init, headers });
}

function createLiveClient(storageKey: string): TypedSupabaseClient {
  return createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    db: { schema: "public" },
    global: { fetch: liveFetch },
    auth: { debug: false,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const staffSupabase = createLiveClient("ss_staff_auth_frtzlibogmethppqmhtr_v1");
export const customerSupabase = createLiveClient("ss_customer_auth_frtzlibogmethppqmhtr_v1");

function activeClient() {
  if (typeof window === "undefined") return staffSupabase;
  const path = window.location.pathname;
  return path === "/login" || path === "/admin" || path.startsWith("/admin/")
    ? staffSupabase
    : customerSupabase;
}

export const supabase = new Proxy({} as TypedSupabaseClient, {
  get(_target, property) {
    const client = activeClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
