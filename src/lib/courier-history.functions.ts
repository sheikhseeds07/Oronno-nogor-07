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
  steadfast?: SteadfastScore;
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

const COURIER_KEY_RE = /^(steadfast|steadfastcourier|redx|redex|redxbd|pathao|pathaocourier|carrybee|paperfly|ecourier|sundarban|sundarbancourier)$/;
const SKIP_KEY_RE = /^(data|summary|summaries|courierdata|couriers|courier|root|total|totals|overall|meta|result|response|payload|info|status|message|report|reports|details)$/;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function parseHoorinStats(payload: unknown): CourierStat[] {
  if (!payload || typeof payload !== "object") return [];
  const found = new Map<string, CourierStat>();
  const visit = (key: string, value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 7) return;
    if (Array.isArray(value)) {
      for (const entry of value) if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        visit(typeof row.name === "string" ? row.name : typeof row.courier === "string" ? row.courier : key, row, depth + 1);
      }
      return;
    }
    const row = value as Record<string, unknown>;
    const inner = row.summary && typeof row.summary === "object" && !Array.isArray(row.summary) ? row.summary as Record<string, unknown> : row;
    const total = num(inner["Total Parcels"] ?? inner["Total Delivery"] ?? inner.total_parcel ?? inner.totalParcel ?? inner.total ?? inner.total_parcels ?? inner.totalParcels ?? inner.total_orders ?? inner.totalOrders ?? inner.parcel_count ?? inner.parcelCount ?? inner.order_count ?? inner.orderCount);
    const success = num(inner["Delivered Parcels"] ?? inner["Successful Delivery"] ?? inner.delivered_parcels ?? inner.success_parcel ?? inner.successParcel ?? inner.success ?? inner.delivered ?? inner.delivered_parcel ?? inner.total_delivered ?? inner.delivered_count ?? inner.delivered_orders ?? inner.deliveredOrders ?? inner.successful_orders ?? inner.successfulOrders ?? inner.success_count ?? inner.successCount);
    const cancelled = num(inner["Canceled Parcels"] ?? inner["Canceled Delivery"] ?? inner["Cancelled Parcels"] ?? inner.cancelled_parcels ?? inner.canceled_parcels ?? inner.cancelled_parcel ?? inner.cancelledParcel ?? inner.cancel ?? inner.cancelled ?? inner.total_cancelled ?? inner.cancelled_count ?? inner.cancelled_orders ?? inner.cancelledOrders ?? inner.canceled_orders ?? inner.canceledOrders ?? inner.cancel_count ?? inner.cancelCount);
    const rawName = typeof inner.name === "string" && inner.name.trim() ? inner.name.trim() : key;
    const normalized = rawName.replace(/[\s_-]/g, "").toLowerCase();
    const hasCounts = Object.keys(inner).some(k => ["Total Parcels","Total Delivery","total_parcel","totalParcel","total","Delivered Parcels","Successful Delivery","delivered","delivered_parcels","success","Canceled Parcels","Cancelled Parcels","cancelled","cancelled_parcels"].includes(k));
    if ((COURIER_KEY_RE.test(normalized) || hasCounts) && !SKIP_KEY_RE.test(normalized) && (total || success || cancelled || COURIER_KEY_RE.test(normalized))) {
      const names: Record<string,string> = {steadfast:"Steadfast",steadfastcourier:"Steadfast",redx:"RedX",redex:"RedX",redxbd:"RedX",pathao:"Pathao",pathaocourier:"Pathao",carrybee:"Carrybee",paperfly:"Paperfly",ecourier:"eCourier",sundarban:"Sundarban",sundarbancourier:"Sundarban"};
      const name = names[normalized] ?? rawName;
      const id = name.toLowerCase();
      const prev = found.get(id);
      if (!prev || total > prev.total || (total === prev.total && success > prev.success)) found.set(id,{name,total,success,cancelled});
    }
    for (const [k,v] of Object.entries(row)) if (v && typeof v === "object") visit(k,v,depth+1);
  };
  visit("root", payload, 0);
  return Array.from(found.values()).filter(s => s.total || s.success || s.cancelled).sort((a,b)=>b.total-a.total);
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


// Hoorin first. Since 27 Sep 2026 Steadfast no longer exposes parcel counts
// (Hoorin returns 0 for Steadfast). When that happens, ask Steadfast's own
// fraud_check/score API for the customer's network-wide delivery ratio.
export type SteadfastScore = { deliveryRatio: number; cancellationRatio: number; volumeBand: string | null };
const steadfastScoreCache = new Map<string, { expiresAt: number; score: SteadfastScore | null }>();
async function steadfastScore(phone: string): Promise<SteadfastScore | null> {
  const p = phone.slice(-11);
  if (p.length < 11) return null;
  const hit = steadfastScoreCache.get(p);
  if (hit && hit.expiresAt > Date.now()) return hit.score;
  const admin = supabaseAdmin as any;
  const { data } = await admin.from("integrations").select("config,is_active")
    .in("name", ["all_api_steadfast", "all_api_steadfast_2"]);
  let score: SteadfastScore | null = null;
  for (const row of (data ?? []) as { config: Record<string, unknown>; is_active: boolean }[]) {
    const ak = String(row.config?.api_key ?? "").trim();
    const sk = String(row.config?.secret_key ?? "").trim();
    if (!row.is_active || !ak || !sk) continue;
    try {
      const res = await fetch(`https://portal.packzy.com/api/v1/fraud_check/score/${p}`, {
        headers: { "Api-Key": ak, "Secret-Key": sk, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const band = typeof j.volume_band === "string" ? j.volume_band : null;
      if (band && band !== "none" && Number.isFinite(Number(j.delivery_ratio))) {
        score = { deliveryRatio: Number(j.delivery_ratio), cancellationRatio: num(j.cancellation_ratio), volumeBand: band };
      }
      break;
    } catch { /* try next account */ }
  }
  steadfastScoreCache.set(p, { expiresAt: Date.now() + (score ? 6 * 60 * 60_000 : 30 * 60_000), score });
  if (steadfastScoreCache.size > 3000) steadfastScoreCache.delete(steadfastScoreCache.keys().next().value as string);
  return score;
}

async function withSteadfast(phone: string, result: CourierHistoryResult): Promise<CourierHistoryResult> {
  if (!result.configured || result.steadfast) return result;
  const existing = result.stats.find((s) => s.name.toLowerCase() === "steadfast");
  if (existing && existing.total > 0) return result;
  const score = await steadfastScore(phone).catch(() => null);
  if (!score) return result;
  // Steadfast gives only ratios now. Owner-approved estimate: fixed total of
  // 10, split by the real ratios, so it can join Overall (e.g. 50% -> 5 success).
  const total = 10;
  const success = Math.round((total * score.deliveryRatio) / 100);
  const cancelled = Math.min(total - success, Math.round((total * score.cancellationRatio) / 100));
  const est: CourierStat = { name: "Steadfast (আনুমানিক)", total, success, cancelled };
  const stats = [...result.stats.filter((s) => !s.name.toLowerCase().startsWith("steadfast")), est];
  const o = result.overall;
  const overall = o
    ? { ...o, total: o.total + total, success: o.success + success, cancelled: o.cancelled + cancelled }
    : { name: "Overall", total: stats.reduce((a, x) => a + x.total, 0), success: stats.reduce((a, x) => a + x.success, 0), cancelled: stats.reduce((a, x) => a + x.cancelled, 0) };
  return { ...result, stats, overall, steadfast: score };
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
        return withSteadfast(phone, cached);
      }
      if (memoryCached) return withSteadfast(phone, memoryCached);
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
        const stats = parseHoorinStats(payload);
        const overall = aggregateOverall(stats);
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
    })().then((r) => withSteadfast(phone, r));

    inFlight.set(cacheKey, request);
    try {
      const result = await request;
      writeCache(cacheKey, result);
      return result;
    } finally {
      inFlight.delete(cacheKey);
    }
  });
