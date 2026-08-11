// Resilient auth middleware: falls back to VITE_ env vars on the server
// when SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not set (common on Vercel
// where users only configure the VITE_ vars).
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getEnv(name: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  // Vite inlines import.meta.env.VITE_* at build time; safe on server too.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (import.meta as any)?.env;
    if (meta && meta[name]) return meta[name] as string;
  } catch {}
  return undefined;
}

function resolveSupabaseUrl(): string | undefined {
  return getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
}

function resolvePublishableKey(): string | undefined {
  return (
    getEnv("SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("VITE_SUPABASE_ANON_KEY")
  );
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = resolveSupabaseUrl();
  const SUPABASE_PUBLISHABLE_KEY = resolvePublishableKey();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in Vercel → Settings → Environment Variables.`,
    );
  }

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Unauthorized: No token provided");

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
  if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

  return next({
    context: { supabase, userId: data.claims.sub, claims: data.claims },
  });
});
