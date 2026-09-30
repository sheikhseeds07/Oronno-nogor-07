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
const PERSISTENT_READ_TTL_MS = 5 * 60_000;
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

function aggregateOverall(stats: CourierStat[]): CourierOverall {
  let total = 0;
  let success = 0;
  let cancelled = 0;
  for (const row of stats) {
    total += Number(row.total) || 0;
    success += Number(row.success) || 0;
    cancelled += Number(row.cancelled) || 0;
  }
  return { name: "Overall", total, success, cancelled };
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
  const courierStats = cachedStats.filter((row) => row.name.toLowerCase() !== "overall");
  const cachedOverall =
    cachedStats.find((row) => row.name.toLowerCase() === "overall") ??
    aggregateOverall(courierStats);
  const result: CourierHistoryResult = {
    configured: Boolean(data.configured),
    stats: courierStats,
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
      // Courier success history changes when the courier provider updates its
      // records, not when a new local shop order is created. Reuse the persisted
      // 24-hour result instead of forcing another Edge/provider round-trip.
      if (beforeInvoke?.fresh && beforeInvoke.result.configured && !beforeInvoke.result.error) {
        return beforeInvoke.result;
      }

      let value: Partial<CourierHistoryResult> = {};
      try {
        const admin = supabaseAdmin as any;
        const { data: integration, error: integrationError } = await admin
          .from("integrations")
          .select("config,is_active")
          .eq("name", "all_api_hoorin")
          .maybeSingle();
        if (integrationError) throw new Error(integrationError.message);
        const cfg = (integration?.config ?? {}) as Record<string, unknown>;
        const apiKey = String(cfg.api_key ?? "").trim();
        if (!integration?.is_active || !apiKey) {
          return { configured: false, stats: [], error: null };
        }
        const endpoint = "https://plugin.hoorin.com/courier/api/v1/search";
        const response = await fetch(
          `${endpoint}?apiKey=${encodeURIComponent(apiKey)}&searchTerm=${encodeURIComponent(phone)}&view=full&cache=off`,
          { method: "GET", headers: { Accept: "application/json", "Cache-Control": "no-cache" } },
        );
        const text = await response.text();
        let payload: any = null;
        try { payload = JSON.parse(text); } catch { payload = null; }
        if (!response.ok) throw new Error(`Hoorin HTTP ${response.status}`);
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.couriers) ? payload.couriers : [];
        const stats = rows.map((row: any) => ({
          name: String(row?.name ?? row?.courier ?? row?.courier_name ?? "Courier"),
          total: Number(row?.total ?? row?.total_parcel ?? row?.total_parcels ?? row?.["Total Parcels"] ?? 0) || 0,
          success: Number(row?.success ?? row?.delivered ?? row?.delivered_parcels ?? row?.["Delivered Parcels"] ?? 0) || 0,
          cancelled: Number(row?.cancelled ?? row?.cancel ?? row?.cancelled_parcels ?? row?.["Canceled Parcels"] ?? 0) || 0,
        })).filter((row: CourierStat) => row.total || row.success || row.cancelled);
        const overall = payload?.overall && typeof payload.overall === "object"
          ? {
              name: "Overall",
              total: Number(payload.overall.total ?? payload.overall.total_parcels ?? 0) || 0,
              success: Number(payload.overall.success ?? payload.overall.delivered ?? payload.overall.delivered_parcels ?? 0) || 0,
              cancelled: Number(payload.overall.cancelled ?? payload.overall.cancelled_parcels ?? 0) || 0,
            }
          : aggregateOverall(stats);
        value = { configured: true, stats, overall, error: null, source: "hoorin" };
      } catch (directError) {
        const stale = beforeInvoke ?? persistent;
        if (stale?.result.configured && !stale.result.error) return { ...stale.result, stale: true };
        return { configured: true, stats: [], error: directError instanceof Error ? directError.message : "Courier history request failed" };
      }
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
