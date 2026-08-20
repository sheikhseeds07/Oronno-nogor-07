// Server-only Supabase client used by request-scoped server functions.
//
// Important: do not keep a user-authenticated client in a module-level cache.
// Cloudflare isolates can serve multiple requests, so a cached Authorization header
// could leak one user's session into another request. A fresh client is created for
// every top-level access instead.
import "@/lib/crypto-polyfill";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "./types";
import {
  createSupabaseFetch,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "./public-env";

function currentAuthorization(): string | undefined {
  try {
    const value = getRequestHeader("authorization")?.trim();
    return value?.startsWith("Bearer ") ? value : undefined;
  } catch {
    // Background/non-request code has no incoming Authorization header.
    return undefined;
  }
}

function createRequestScopedSupabaseClient() {
  const url = resolveSupabaseUrl();
  const publishableKey = resolveSupabasePublishableKey();
  const authorization = currentAuthorization();

  return createClient<Database>(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      ...(authorization ? { headers: { Authorization: authorization } } : {}),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Backward-compatible name. Request-driven admin/employee operations now run as
// the signed-in user and therefore respect the existing RLS + permission model.
// Truly privileged Auth Admin operations are routed through the protected
// `admin-bridge` Edge Function instead of embedding a service key in the repo.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createRequestScopedSupabaseClient>, {
  get(_, prop) {
    const client = createRequestScopedSupabaseClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
