import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "./db.types";
import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "./client";

function createRequestClient(): SupabaseClient<Database> {
  let authorization: string | undefined;
  try {
    const header = getRequestHeader("authorization")?.trim();
    if (header?.startsWith("Bearer ")) authorization = header;
  } catch {
    authorization = undefined;
  }

  return createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    global: {
      ...(authorization ? { headers: { Authorization: authorization } } : {}),
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        if (headers.get("Authorization") === `Bearer ${LIVE_DATABASE_KEY}`) headers.delete("Authorization");
        headers.set("apikey", LIVE_DATABASE_KEY);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    const client = createRequestClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
