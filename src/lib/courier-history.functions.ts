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

export type CourierOverall = CourierStat;

type CourierHistoryResult = {
  configured: boolean;
  stats: CourierStat[];
  overall?: CourierOverall;
  error: string | null;
  stale?: boolean;
  source?: string;
};

type CacheEntry = { expiresAt: number; result: CourierHistoryResult };
type PersistentHit = { result: CourierHistoryResult; fresh: boolean; fetchedAtMs: number };

const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 15 * 1000;
const STALE_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = "courier-history-v12-live-courier-history";
const MAX_CACHE_ENTRIES = 3000;

const courierCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourierHistoryResult>>();

// Deduplicate repeated persistent-cache reads during Admin list renders.
// This does not change courier-history freshness; it only avoids repeated
// database reads for the same phone within a short burst.
const PERSISTENT_READ_TTL_MS = 30_000;
const persistentReadCache = new Map<string, { expiresAt: number; hit: PersistentHit | null }>();
const persistentReadInFlight = new Map<string, Promise<PersistentHit | null>>();

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
  const now = Date.now();
  for (const [k, entry] of courierCache) if (entry.expiresAt <= now) courierCache.delete(k);
  while (courierCache.size >= MAX_CACHE_ENTRIES) {
    const first = courierCache.keys().next().value as string | undefined;
    if (!first) break;
    courierCache.delete(first);
  }
  const ttl = result.stale
    ? STALE_CACHE_TTL_MS
    : result.error || !result.configured
      ? FAILURE_CACHE_TTL_MS
      : SUCCESS_CACHE_TTL_MS;
  courierCache.set(key, { expiresAt: now + ttl, result });
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
  const cached = persistentReadCache.get(phone);
  if (cached && cached.expiresAt > Date.now()) return cached.hit;
  if (cached) persistentReadCache.delete(phone);

  const inFlightRead = persistentReadInFlight.get(phone);
  if (inFlightRead) return inFlightRead;

  const request = (async (): Promise<PersistentHit | null> => {
  const admin = supabaseAdmin as any;
  const { data, error } = await admin
    .from("courier_history_cache")
    .select("configured,stats,error,expires_at,fetched_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data) return null;

  const cachedStats = normalizeStats(data.stats);
  const cachedOverall = cachedStats.find((row) => row.name.toLowerCase() === "overall");
  const result: CourierHistoryResult = {
    configured: Boolean(data.configured),
    stats: cachedStats.filter((row) => row.name.toLowerCase() !== "overall"),
    overall: cachedOverall,
    error: typeof data.error === "string" ? data.error : null,
    source: "cache",
  };
  const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
  const fetchedAtMs = new Date(String(data.fetched_at ?? "")).getTime();
  return { result, fresh: Number.isFinite(expiresAt) && expiresAt > Date.now(), fetchedAtMs };
  })();
  persistentReadInFlight.set(phone, request);
  try {
    const hit = await request;
    persistentReadCache.set(phone, { expiresAt: Date.now() + PERSISTENT_READ_TTL_MS, hit });
    return hit;
  } finally {
    persistentReadInFlight.delete(phone);
  }
}

export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    phone: z.string().min(6).max(20),
    orderCreatedAt: z.string().optional(),
    cacheOnly: z.boolean().optional().default(false),
  }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const phone = data.phone.replace(/\D/g, "");
    const cacheKey = `${CACHE_VERSION}:${phone}`;
    const orderCreatedAtMs = data.orderCreatedAt ? new Date(data.orderCreatedAt).getTime() : 0;
    const memoryCached = readCache(cacheKey);
    const persistent = await readPersistentCache(phone);

    if (data.cacheOnly) {
      if (persistent?.result.configured && !persistent.result.error) {
        const cached = persistent.fresh ? persistent.result : { ...persistent.result, stale: true };
        writeCache(cacheKey, cached);
        return cached;
      }
      if (memoryCached) return memoryCached;
      return { configured: false, stats: [], error: null };
    }

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = (async (): Promise<CourierHistoryResult> => {
      const beforeInvoke = persistent ?? await readPersistentCache(phone);
      // A newly-created order may use a phone number whose courier history was cached earlier.
      // Refresh once for that new order, then subsequent page refreshes reuse the saved result.
      const needsFirstLoadForOrder = Boolean(orderCreatedAtMs && (!beforeInvoke || !Number.isFinite(beforeInvoke.fetchedAtMs) || beforeInvoke.fetchedAtMs < orderCreatedAtMs));
      if (beforeInvoke?.fresh && beforeInvoke.result.configured && !beforeInvoke.result.error && !needsFirstLoadForOrder) {
        return beforeInvoke.result;
      }

      let result: unknown = null;
      let error: { message?: string } | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await context.supabase.functions.invoke("courier-history-bridge", {
          body: { phone, forceRefresh: needsFirstLoadForOrder },
        });
        result = res.data;
        error = res.error as { message?: string } | null;
        if (!error) break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
      }

      if (error) {
        const stale = beforeInvoke ?? persistent;
        if (stale?.result.configured && !stale.result.error) return { ...stale.result, stale: true };
        return { configured: true, stats: [], error: error?.message || "Courier history request failed" };
      }

      const value = (result ?? {}) as Partial<CourierHistoryResult>;
      const normalizedStats = normalizeStats(value.stats);
      const normalizedOverall = value.overall && typeof value.overall === "object"
        ? {
            name: String((value.overall as any).name ?? "Overall"),
            total: Number.isFinite(Number((value.overall as any).total)) ? Number((value.overall as any).total) : 0,
            success: Number.isFinite(Number((value.overall as any).success)) ? Number((value.overall as any).success) : 0,
            cancelled: Number.isFinite(Number((value.overall as any).cancelled)) ? Number((value.overall as any).cancelled) : 0,
          }
        : undefined;
      const normalized: CourierHistoryResult = {
        configured: Boolean(value.configured),
        stats: normalizedStats.filter((row) => row.name.toLowerCase() !== "overall"),
        overall: normalizedOverall,
        error: typeof value.error === "string" ? value.error : null,
        stale: value.stale === true,
        source: typeof value.source === "string" ? value.source : undefined,
      };

      if (normalized.error) {
        const stale = beforeInvoke ?? persistent;
        if (stale?.result.configured && !stale.result.error) return { ...stale.result, stale: true };
      }

      return normalized;
    })();

    inFlight.set(cacheKey, request);
    try {
      const result = await request;
      writeCache(cacheKey, result);
      return result;
    } finally {
      inFlight.delete(cacheKey);
    }
  });
