import { logger } from "@/lib/logger";
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Attach a session token when one is available. Public server functions
// (checkout, landing pages, visitor tracking, etc.) must remain callable even
// when an old/unsupported browser cannot initialize Supabase Auth correctly.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (error) {
    logger.warn("[Supabase auth] session unavailable; continuing without auth header", error);
    return next({ headers: {} });
  }
});
