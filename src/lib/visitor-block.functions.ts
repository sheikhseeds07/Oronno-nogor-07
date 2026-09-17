import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabase } from "@/lib/personal-supabase/client";

type CacheEntry = { blocked: boolean; at: number };
// Speed: this check runs on the root loader of every page view, so a cold cache
// costs the visitor a database round-trip before HTML streams. Allowed visitors
// (the overwhelming majority) are remembered far longer than blocked ones, so
// ad traffic reaches the landing page without paying for the lookup.
const ALLOW_CACHE_MS = 600_000;
const BLOCK_CACHE_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/**
 * Site-wide block check for the current visitor IP.
 * Public on purpose: it only answers "is this request's own IP blocked".
 */
export const getVisitorBlockStatus = createServerFn({ method: "GET" }).handler(async () => {
  const ip = getRequestIP({ xForwardedFor: true }) ?? null;
  if (!ip) return { blocked: false, ip: null as string | null };

  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < (hit.blocked ? BLOCK_CACHE_MS : ALLOW_CACHE_MS)) return { blocked: hit.blocked, ip };

  const { data, error } = await (supabase as any).rpc("is_blocked_visitor", { p_ip: ip, p_phone: null });
  if (error) {
    console.error("[getVisitorBlockStatus] check failed:", error.message);
    return { blocked: false, ip };
  }
  const blocked = data === true;
  cache.set(ip, { blocked, at: Date.now() });
  return { blocked, ip };
});

const GateSchema = z.object({
  deviceId: z.string().min(6).max(80).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});

/**
 * Device + account level block gate.
 * Runs with elevated privileges so a blocked visitor cannot bypass it via RLS.
 * Returns only a boolean — never any customer data.
 */
export const getSiteBlockStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => GateSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const deviceId = data.deviceId ?? null;
    const customerId = data.customerId ?? null;
    if (!deviceId && !customerId) return { blocked: false };

    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const db = supabaseAdmin as any;

    try {
      // Remember this device for the logged-in customer so a block also stops the device.
      if (deviceId && customerId) {
        await db.from("customer_devices").upsert(
          { customer_id: customerId, device_id: deviceId, last_seen_at: new Date().toISOString() },
          { onConflict: "customer_id,device_id" },
        );
      }

      if (customerId) {
        const { data: row } = await db
          .from("customer_profiles")
          .select("is_blocked")
          .eq("id", customerId)
          .maybeSingle();
        if (row?.is_blocked) return { blocked: true };
      }

      if (deviceId) {
        const { data: rows } = await db
          .from("customer_devices")
          .select("customer_id")
          .eq("device_id", deviceId)
          .limit(50);
        const ids = (rows ?? []).map((r: any) => r.customer_id).filter(Boolean);
        if (ids.length) {
          const { data: blockedRows } = await db
            .from("customer_profiles")
            .select("id")
            .in("id", ids)
            .eq("is_blocked", true)
            .limit(1);
          if (blockedRows?.length) return { blocked: true };
        }
      }
    } catch (err) {
      console.error("[getSiteBlockStatus] check failed:", (err as Error).message);
    }

    return { blocked: false };
  });
