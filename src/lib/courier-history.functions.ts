import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";

export type CourierStat = {
  name: string;
  total: number;
  success: number;
  cancelled: number;
};

type CourierHistoryResult = {
  configured: boolean;
  stats: CourierStat[];
  error: string | null;
};

// Short-lived server-side cache: refreshing an order section must not call
// the external courier API again for the same phone every time.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_VERSION = "steadfast-fallback-v2";
const courierCache = new Map<string, { expiresAt: number; result: CourierHistoryResult }>();
const inFlight = new Map<string, Promise<CourierHistoryResult>>();

// Sensitive Hoorin / courier credentials stay inside the protected Supabase
// Edge Function. The browser/server action only receives aggregated stats.
export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().min(6).max(20) }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const phone = data.phone.replace(/\D/g, "");
    const cacheKey = `${CACHE_VERSION}:${phone}`;
    const cached = courierCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = (async (): Promise<CourierHistoryResult> => {
      const { data: result, error } = await context.supabase.functions.invoke("courier-history-bridge", {
        body: { phone },
      });
      if (error) {
        return { configured: true, stats: [], error: error.message || "Courier history request failed" };
      }
      const value = (result ?? {}) as Partial<CourierHistoryResult>;
      return {
        configured: Boolean(value.configured),
        stats: Array.isArray(value.stats) ? value.stats : [],
        error: typeof value.error === "string" ? value.error : null,
      };
    })();

    inFlight.set(cacheKey, request);
    try {
      const result = await request;
      // Provider failures are returned with `error`, so transient 429/Packzy
      // failures are never cached as a misleading Steadfast 0% score.
      if (result.configured && !result.error) {
        courierCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
      }
      return result;
    } finally {
      inFlight.delete(cacheKey);
    }
  });
