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
  stale?: boolean;
};

type CacheEntry = { expiresAt: number; result: CourierHistoryResult };

// Emergency egress protection: courier success history changes slowly, while the
// admin order list can render hundreds of rows at once. Keep successful results
// for a full day so repeated page loads/tabs do not re-invoke the Edge Function.
const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Cache provider failures long enough to stop retry storms, but not long enough
// to hide a recovered provider for an excessive period.
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_CACHE_TTL_MS = 30 * 60 * 1000;
// Bump whenever cache semantics change so stale process-level entries cannot be reused.
const CACHE_VERSION = "courier-history-v6-egress-guard";
const MAX_CACHE_ENTRIES = 2000;
// One outgoing Edge invocation at a time per server isolate. This protects the
// project from a table render turning into dozens of simultaneous invocations.
const MAX_EXTERNAL_CONCURRENCY = 1;

const courierCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourierHistoryResult>>();
let activeExternalRequests = 0;
const externalWaiters: Array<() => void> = [];

function readCache(key: string): CourierHistoryResult | null {
  const hit = courierCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    courierCache.delete(key);
    return null;
  }
  return hit.result;
}

function writeCache(key: string, result: CourierHistoryResult) {
  if (courierCache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of courierCache) {
      if (entry.expiresAt <= now) courierCache.delete(k);
    }
    while (courierCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = courierCache.keys().next().value as string | undefined;
      if (!oldest) break;
      courierCache.delete(oldest);
    }
  }
  const ttl = result.stale
    ? STALE_CACHE_TTL_MS
    : result.error || !result.configured
      ? FAILURE_CACHE_TTL_MS
      : SUCCESS_CACHE_TTL_MS;
  courierCache.set(key, { expiresAt: Date.now() + ttl, result });
}

async function withExternalSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeExternalRequests >= MAX_EXTERNAL_CONCURRENCY) {
    await new Promise<void>((resolve) => externalWaiters.push(resolve));
  }
  activeExternalRequests += 1;
  try {
    return await fn();
  } finally {
    activeExternalRequests = Math.max(0, activeExternalRequests - 1);
    externalWaiters.shift()?.();
  }
}

// Sensitive Hoorin / courier credentials stay inside the protected Supabase
// Edge Function. The browser/server action only receives aggregated stats.
export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().min(6).max(20) }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const phone = data.phone.replace(/\D/g, "");
    const cacheKey = `${CACHE_VERSION}:${phone}`;
    const cached = readCache(cacheKey);
    if (cached) return cached;

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = withExternalSlot(async (): Promise<CourierHistoryResult> => {
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
        stale: value.stale === true,
      };
    });

    inFlight.set(cacheKey, request);
    try {
      const result = await request;
      writeCache(cacheKey, result);
      return result;
    } finally {
      inFlight.delete(cacheKey);
    }
  });
