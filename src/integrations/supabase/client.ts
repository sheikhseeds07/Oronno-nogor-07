import "@/lib/crypto-polyfill";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { publicReadProxyUrl, isPublicAnonRead } from "./public-read-proxy";

type Client = SupabaseClient<Database>;

function envValue(...names: string[]) {
  for (const name of names) {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env?.[name];
    const proc = typeof process !== "undefined" ? process.env?.[name] : undefined;
    if (meta) return meta;
    if (proc) return proc;
  }
  return undefined;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string, supabaseUrl: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) headers.delete("Authorization");
    headers.set("apikey", supabaseKey);
    const method = (init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const auth = headers.get("Authorization");
    const hasUserToken = Boolean(auth && auth !== `Bearer ${supabaseKey}`);
    const bodyText = typeof init?.body === "string" ? init.body : undefined;
    const proxied = publicReadProxyUrl(rawUrl, supabaseUrl, method, bodyText, hasUserToken);

    if (proxied) {
      const proxyHeaders = new Headers();
      const accept = headers.get("Accept");
      if (accept) proxyHeaders.set("Accept", accept);
      const range = headers.get("Range");
      if (range) proxyHeaders.set("Range", range);
      try {
        const cached = await fetch(proxied, { method: "GET", headers: proxyHeaders });
        if (cached.ok) return cached;
      } catch {}
    }

    if (typeof window === "undefined" && method === "POST" && !hasUserToken && bodyText !== undefined && bodyText.length <= 500 && isPublicAnonRead(rawUrl, supabaseUrl, method, hasUserToken)) {
      const edge = (globalThis as { caches?: { default?: { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> } } }).caches?.default;
      if (edge) {
        const keyReq = new Request(`${supabaseUrl}/__rpc-cache?u=${encodeURIComponent(rawUrl)}&b=${encodeURIComponent(bodyText)}`, { method: "GET" });
        try { const hit = await edge.match(keyReq); if (hit) return hit; } catch {}
        const fresh = await fetch(input, { ...init, headers });
        if (fresh.ok) {
          const text = await fresh.text();
          const cacheable = new Response(text, { status: 200, headers: { "Content-Type": fresh.headers.get("content-type") || "application/json", "Cache-Control": "public, max-age=300" } });
          try { await edge.put(keyReq, cacheable.clone()); } catch {}
          return cacheable;
        }
        return fresh;
      }
    }

    if (typeof window === "undefined" && isPublicAnonRead(rawUrl, supabaseUrl, method, hasUserToken)) {
      try { return await fetch(input, { ...init, headers, cf: { cacheEverything: true, cacheTtl: 300 } } as RequestInit); } catch {}
    }
    return fetch(input, { ...init, headers });
  };
}

const cache = new Map<string, Client>();

function actualClient(storageKey: string): Client {
  const existing = cache.get(storageKey);
  if (existing) return existing;

  const rawUrl = envValue("VITE_SUPABASE_URL", "SUPABASE_URL");
  const key = envValue("VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (!rawUrl || !key) throw new Error("Supabase URL/publishable key is not configured");
  const url = rawUrl.replace(/\/$/, "");

  const client = createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key, url) },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  cache.set(storageKey, client);
  return client;
}

function lazyClient(storageKey: string): Client {
  return new Proxy({} as Client, {
    get(_target, property) {
      const client = actualClient(storageKey);
      const value = Reflect.get(client, property, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const staffSupabase = lazyClient("ss_staff_auth_v1");
export const customerSupabase = lazyClient("ss_customer_auth_v1");

function getActiveClient(): Client {
  if (typeof window === "undefined") return staffSupabase;
  const path = window.location.pathname;
  return path === "/login" || path === "/admin" || path.startsWith("/admin/") ? staffSupabase : customerSupabase;
}

export const supabase = new Proxy({} as Client, {
  get(_target, property) {
    const client = getActiveClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
