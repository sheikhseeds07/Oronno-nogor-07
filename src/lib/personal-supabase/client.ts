// The shop's production data remains in its original project after this app was
// moved to a new workspace. Keep this wrapper independent from workspace-injected
// VITE_* values so a move cannot silently point the storefront at an empty DB.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

export const LIVE_DATABASE_URL = "https://bvuhvzccziuniujeogng.supabase.co";
export const LIVE_DATABASE_KEY = "sb_publishable_rapcUAgVGYdCuww7Q6GRNg__kFKVc17";

function liveFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (headers.get("Authorization") === `Bearer ${LIVE_DATABASE_KEY}`) headers.delete("Authorization");
  headers.set("apikey", LIVE_DATABASE_KEY);
  return fetch(input, { ...init, headers });
}

function createLiveClient(storageKey: string): TypedSupabaseClient {
  return createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    global: { fetch: liveFetch },
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export const staffSupabase = createLiveClient("ss_staff_auth_v1");
export const customerSupabase = createLiveClient("ss_customer_auth_v1");

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
