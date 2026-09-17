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
  source?: string;
};

type CacheEntry = { expiresAt: number; result: CourierHistoryResult };
type PersistentHit = { result: CourierHistoryResult; fresh: boolean };

const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 15 * 1000;
const STALE_CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_VERSION = "courier-history-v13-redx-placeholder-zero";
const MAX_CACHE_ENTRIES = 3000;

const courierCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CourierHistoryResult>>();

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
  const int = (raw: unknown) => {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  };
  return value
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => {
      const name = String(row.name ?? "Courier").trim() || "Courier";
      const total = int(row.total);
      let success = Math.min(int(row.success), total);
      let cancelled = Math.min(int(row.cancelled), total);
      if (success + cancelled > total) cancelled = Math.max(0, total - success);
      const courierId = name.replace(/[\s_-]/g, "").toLowerCase();
      const isRedxPlaceholder =
        ["redx", "redex", "redxbd"].includes(courierId) && total === 10 && success === 6 && cancelled === 4;
      // Keep the card visible, but blank out the provider placeholder numbers.
      if (isRedxPlaceholder) return { name, total: 0, success: 0, cancelled: 0, keep: true };
      return { name, total, success, cancelled, keep: total > 0 };
    })
    .filter((row) => row.keep)
    .map(({ name, total, success, cancelled }) => ({ name, total, success, cancelled }))
    .sort((a, b) => b.total - a.total);
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
    source: "cache",
  };
  const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
  return { result, fresh: Number.isFinite(expiresAt) && expiresAt > Date.now() };
}

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
    if (memoryCached?.configured && !memoryCached.error && !memoryCached.stale) return memoryCached;

    const persistent = await readPersistentCache(phone);
    if (persistent?.fresh && persistent.result.configured && !persistent.result.error) {
      writeCache(cacheKey, persistent.result);
      return persistent.result;
    }

    if (data.cacheOnly) {
      if (persistent?.result.configured && !persistent.result.error) {
        const cached = persistent.fresh ? persistent.result : { ...persistent.result, stale: true };
        writeCache(cacheKey, cached);
        return cached;
      }
      if (memoryCached) return memoryCached;
      return { configured: false, stats: [], error: null };
    }

    if (memoryCached && !memoryCached.error) return memoryCached;

    const existing = inFlight.get(cacheKey);
    if (existing) return existing;

    const request = (async (): Promise<CourierHistoryResult> => {
      const beforeInvoke = await readPersistentCache(phone);
      if (beforeInvoke?.fresh && beforeInvoke.result.configured && !beforeInvoke.result.error) {
        return beforeInvoke.result;
      }

      let result: unknown = null;
      let error: { message?: string } | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await context.supabase.functions.invoke("courier-history-bridge", {
          body: { phone },
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
      const normalized: CourierHistoryResult = {
        configured: Boolean(value.configured),
        stats: normalizeStats(value.stats),
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
