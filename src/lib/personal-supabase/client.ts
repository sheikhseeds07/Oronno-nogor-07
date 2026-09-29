import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

function envValue(...names: string[]) {
  for (const name of names) {
    const meta = (import.meta as unknown as { env?: Record<string, string> }).env?.[name];
    const proc = typeof process !== "undefined" ? process.env?.[name] : undefined;
    if (meta) return meta;
    if (proc) return proc;
  }
  return undefined;
}

export function liveDatabaseConfig() {
  const url = envValue("VITE_SUPABASE_URL", "SUPABASE_URL")?.replace(/\/$/, "");
  const key = envValue(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
  );
  if (!url || !key) throw new Error("Supabase URL/publishable key is not configured");
  return { url, key };
}

function createLiveClient(storageKey: string): TypedSupabaseClient {
  const { url, key } = liveDatabaseConfig();
  const liveFetch: typeof fetch = (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient<Database>(url, key, {
    global: { fetch: liveFetch },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

const clientCache = new Map<string, TypedSupabaseClient>();
function actualClient(storageKey: string) {
  const existing = clientCache.get(storageKey);
  if (existing) return existing;
  const client = createLiveClient(storageKey);
  clientCache.set(storageKey, client);
  return client;
}

function lazyClient(storageKey: string): TypedSupabaseClient {
  return new Proxy({} as TypedSupabaseClient, {
    get(_target, property) {
      const client = actualClient(storageKey);
      const value = Reflect.get(client, property, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const staffSupabase = lazyClient("ss_staff_auth_v1");
export const customerSupabase = lazyClient("ss_customer_auth_v1");

function activeClient(): TypedSupabaseClient {
  if (typeof window === "undefined") return staffSupabase;
  const path = window.location.pathname;
  return path === "/login" || path === "/admin" || path.startsWith("/admin/") ? staffSupabase : customerSupabase;
}

export const supabase = new Proxy({} as TypedSupabaseClient, {
  get(_target, property) {
    const client = activeClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
