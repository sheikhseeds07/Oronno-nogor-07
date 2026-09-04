import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { supabase } from "@/integrations/supabase/client";

type CacheEntry = { blocked: boolean; at: number };
const CACHE_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/**
 * Site-wide block check for the current visitor IP.
 * Public on purpose: it only answers "is this request's own IP blocked".
 */
export const getVisitorBlockStatus = createServerFn({ method: "GET" }).handler(async () => {
  const ip = getRequestIP({ xForwardedFor: true }) ?? null;
  if (!ip) return { blocked: false, ip: null as string | null };

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_MS) return { blocked: hit.blocked, ip };

  const { data, error } = await (supabase as any).rpc("is_blocked_visitor", { p_ip: ip, p_phone: null });
  if (error) {
    console.error("[getVisitorBlockStatus] check failed:", error.message);
    return { blocked: false, ip };
  }
  const blocked = data === true;
  cache.set(ip, { blocked, at: Date.now() });
  return { blocked, ip };
});
