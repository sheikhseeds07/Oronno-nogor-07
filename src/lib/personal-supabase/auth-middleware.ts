// Resilient auth middleware: resolves the Supabase URL / publishable key from
// any of the common env aliases and falls back to the live project's built-in
// values, so admin actions keep working even when the host injects no env vars.
import "@/lib/crypto-polyfill";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/personal-supabase/db.types";
import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "@/lib/personal-supabase/client";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: No token provided");

  const supabase = createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        headers.set("apikey", LIVE_DATABASE_KEY);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
  if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});
