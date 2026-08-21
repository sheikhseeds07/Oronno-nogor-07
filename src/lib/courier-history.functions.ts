import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
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
type PersistentHit = { result: CourierHistoryResult; fresh: boolean };

// Courier history is a fraud/risk hint, not a live parcel status. Keeping a
// successful lookup for one day prevents the admin order table from turning
// every page load into dozens of external courier requests.
const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = "courier-history-v8-cache-only-rows";
const MAX_CACHE_ENTRIES = 2000;
const MAX_EXTERNAL_CONCURRENCY = 1;
const GLOBAL_EDGE_GAP_MS = 1500;

const courierCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourierHistoryResult>>();
let activeExternalRequests = 0;
const externalWaiters: Array<() => void> = [];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

function normalizeStats(value: unknown): CourierStat[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      name: String(row.name ?? "Courier"),
      total: Number.isFinite(Number(row.total)) ? Number(row.total) : 0,
      success: Number.isFinite(Number(row.success)) ? Number(row.success) : 0,
      cancelled: Number.isFinite(Number(row.cancelled)) ? Number(row.cancelled) : 0,
    }));
}

async function readPersistentCache(phone: string): Promise<PersistentHit | null> {
  const admin = supabaseAdmin as any;
  const { data, error } = await admin
    .from("courier_history_cache")
    .select("configured,stats,error,expires_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data) return null;

  const result: CourierHistoryResult = {
    configured: Boolean(data.configured),
    stats: normalizeStats(data.stats),
    error: typeof data.error === "string" ? data.error : null,
  };
  const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
  return { result, fresh: Number.isFinite(expiresAt) && expiresAt > Date.now() };
}

async function hoorinIsConfigured(): Promise<boolean> {
  const admin = supabaseAdmin as any;
  const { data } = await admin
    .from("integrations")
    .select("is_active,config")
    .eq("name", "all_api_hoorin")
    .maybeSingle();
  const config = data?.config && typeof data.config === "object" ? data.config as Record<string, unknown> : {};
  return Boolean(data?.is_active && String(config.api_key ?? "").trim());
}

async function reserveGlobalEdgeSlot(): Promise<number> {
  const admin = supabaseAdmin as any;
  const { data, error } = await admin.rpc("reserve_courier_edge_slot", { p_gap_ms: GLOBAL_EDGE_GAP_MS });
  if (error) return GLOBAL_EDGE_GAP_MS;
  const waitMs = Number(data ?? 0);
  return Number.isFinite(waitMs) ? Math.max(0, Math.min(waitMs, 120_000)) : GLOBAL_EDGE_GAP_MS;
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

// Order-list rows request cacheOnly=true so the old percentage UI can render
// without ever invoking the external courier bridge. New Order / order detail
// keep the normal behavior and may refresh a missing/expired phone on demand.
export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    phone: z.string().min(6).max(20),
    cacheOnly: z.boolean().optional().default(false),
  }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const phone = data.phone.replace(/\D/g, "");
    const cacheKey = `${CACHE_VERSION}:${phone}`;
    const memoryCached = readCache(cacheKey);

    if (memoryCached?.configured && !memoryCached.error && !memoryCached.stale) {
      return memoryCached;
    }

    const persistent = await readPersistentCache(phone);
    if (persistent?.fresh && persistent.result.configured && !persistent.result.error) {
      writeCache(cacheKey, persistent.result);
      return persistent.result;
    }

    // Critical egress guard: table rows never trigger courier-history-bridge.
    // They display the same old success-rate UI using persistent cache only.
    if (data.cacheOnly) {
      if (persistent?.result.configured && !persistent.result.error) {
        const cached = persistent.fresh ? persistent.result : { ...persistent.result, stale: true };
        writeCache(cacheKey, cached);
        return cached;
      }
      if (memoryCached) return memoryCached;
      return { configured: false, stats: [], error: null };
    }

    if (memoryCached) return memoryCached;

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = withExternalSlot(async (): Promise<CourierHistoryResult> => {
      const waitMs = await reserveGlobalEdgeSlot();
      if (waitMs > 0) await sleep(waitMs);

      const afterWait = await readPersistentCache(phone);
      if (afterWait?.fresh && afterWait.result.configured && !afterWait.result.error) {
        return afterWait.result;
      }

      const { data: result, error } = await context.supabase.functions.invoke("courier-history-bridge", {
        body: { phone },
      });

      if (error) {
        const stale = afterWait ?? persistent;
        if (stale?.result.configured && !stale.result.error) {
          return { ...stale.result, stale: true };
        }
        return { configured: true, stats: [], error: error.message || "Courier history request failed" };
      }

      const value = (result ?? {}) as Partial<CourierHistoryResult>;
      let normalized: CourierHistoryResult = {
        configured: Boolean(value.configured),
        stats: normalizeStats(value.stats),
        error: typeof value.error === "string" ? value.error : null,
        stale: value.stale === true,
      };

      if (!normalized.configured && await hoorinIsConfigured()) {
        normalized = {
          ...normalized,
          configured: true,
          error: normalized.error ?? "Courier history is temporarily unavailable. Please retry shortly.",
        };
      }

      if ((normalized.error || !normalized.configured) && (afterWait ?? persistent)?.result.configured) {
        const stale = (afterWait ?? persistent)!.result;
        if (!stale.error) return { ...stale, stale: true };
      }

      return normalized;
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
