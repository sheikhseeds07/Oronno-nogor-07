import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type CourierStat = { name: string; total: number; success: number; cancelled: number };
type JsonRecord = Record<string, unknown>;
type HistoryResult = { configured: boolean; stats: CourierStat[]; error: string | null; steadfast_source?: string; stale?: boolean };
type HoorinConfig = { configured: boolean; endpoint: string; apiKey: string; error: string | null };
type PersistentHit = { result: HistoryResult; fresh: boolean };

const COURIER_ORDER = ["Steadfast", "Pathao", "RedX", "Paperfly", "Carrybee", "eCourier"];
const SUCCESS_CACHE_TTL_MS = 30 * 60 * 1000;
const SHORT_CACHE_TTL_MS = 45 * 1000;
const STALE_FALLBACK_TTL_MS = 2 * 60 * 1000;
const AUTHZ_CACHE_TTL_MS = 20 * 1000;
const CONFIG_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const MAX_PROVIDER_CONCURRENCY = 3;
const GLOBAL_PROVIDER_GAP_MS = 220;

const historyCache = new Map<string, { expiresAt: number; result: HistoryResult }>();
const historyInFlight = new Map<string, Promise<HistoryResult>>();
const authzCache = new Map<string, { expiresAt: number; userId: string; authorized: boolean }>();
const authzInFlight = new Map<string, Promise<{ userId: string; authorized: boolean }>>();
let hooringConfigCache: { expiresAt: number; value: HoorinConfig } | null = null;
let hooringConfigInFlight: Promise<HoorinConfig> | null = null;
let activeProviderRequests = 0;
const providerWaiters: Array<() => void> = [];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store",
  },
});
const num = (x: unknown) => { const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : 0; };
const pretty = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readHistoryCache(key: string): HistoryResult | null {
  const hit = historyCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    historyCache.delete(key);
    return null;
  }
  return hit.result;
}

function writeHistoryCache(key: string, result: HistoryResult) {
  const now = Date.now();
  for (const [k, entry] of historyCache) if (entry.expiresAt <= now) historyCache.delete(k);
  while (historyCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = historyCache.keys().next().value as string | undefined;
    if (!oldest) break;
    historyCache.delete(oldest);
  }
  const ttl = result.stale
    ? STALE_FALLBACK_TTL_MS
    : result.configured && !result.error
      ? SUCCESS_CACHE_TTL_MS
      : SHORT_CACHE_TTL_MS;
  historyCache.set(key, { expiresAt: now + ttl, result });
}

async function readPersistentCache(admin: ReturnType<typeof createClient>, phone: string): Promise<PersistentHit | null> {
  const { data, error } = await admin
    .from("courier_history_cache")
    .select("configured,stats,error,steadfast_source,expires_at")
    .eq("phone", phone)
    .maybeSingle();
  if (error || !data) return null;
  const result: HistoryResult = {
    configured: Boolean(data.configured),
    stats: Array.isArray(data.stats) ? data.stats as CourierStat[] : [],
    error: typeof data.error === "string" ? data.error : null,
  };
  if (typeof data.steadfast_source === "string" && data.steadfast_source) result.steadfast_source = data.steadfast_source;
  const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
  return { result, fresh: Number.isFinite(expiresAt) && expiresAt > Date.now() };
}

async function writePersistentSuccess(admin: ReturnType<typeof createClient>, phone: string, result: HistoryResult) {
  if (!result.configured || result.error) return;
  const now = Date.now();
  await admin.from("courier_history_cache").upsert({
    phone,
    configured: true,
    stats: result.stats,
    error: null,
    steadfast_source: result.steadfast_source ?? null,
    fetched_at: new Date(now).toISOString(),
    expires_at: new Date(now + SUCCESS_CACHE_TTL_MS).toISOString(),
  }, { onConflict: "phone" });
}

async function extendPersistentStale(admin: ReturnType<typeof createClient>, phone: string) {
  await admin.from("courier_history_cache")
    .update({ expires_at: new Date(Date.now() + STALE_FALLBACK_TTL_MS).toISOString() })
    .eq("phone", phone);
}

async function reserveGlobalProviderSlot(admin: ReturnType<typeof createClient>): Promise<number> {
  const { data, error } = await admin.rpc("reserve_courier_provider_slot", { p_gap_ms: GLOBAL_PROVIDER_GAP_MS });
  if (error) return GLOBAL_PROVIDER_GAP_MS;
  const waitMs = Number(data ?? 0);
  return Number.isFinite(waitMs) ? Math.max(0, Math.min(waitMs, 120_000)) : GLOBAL_PROVIDER_GAP_MS;
}

async function withProviderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeProviderRequests >= MAX_PROVIDER_CONCURRENCY) {
    await new Promise<void>((resolve) => providerWaiters.push(resolve));
  }
  activeProviderRequests += 1;
  try {
    return await fn();
  } finally {
    activeProviderRequests = Math.max(0, activeProviderRequests - 1);
    providerWaiters.shift()?.();
  }
}

async function authorize(admin: ReturnType<typeof createClient>, token: string): Promise<{ userId: string; authorized: boolean }> {
  const cached = authzCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return { userId: cached.userId, authorized: cached.authorized };
  if (cached) authzCache.delete(token);

  const existing = authzInFlight.get(token);
  if (existing) return existing;

  const request = (async () => {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return { userId: "", authorized: false };

    const [{ data: roles }, { data: perms }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id),
      admin.from("employee_permissions").select("orders").eq("user_id", user.id).maybeSingle(),
    ]);
    const roleNames = new Set((roles ?? []).map((r) => String(r.role)));
    const authorized = roleNames.has("admin") || roleNames.has("super_admin") || Boolean(perms?.orders);
    if (authorized) authzCache.set(token, { expiresAt: Date.now() + AUTHZ_CACHE_TTL_MS, userId: user.id, authorized: true });
    return { userId: user.id, authorized };
  })();

  authzInFlight.set(token, request);
  try {
    return await request;
  } finally {
    authzInFlight.delete(token);
  }
}

async function getHoorinConfig(admin: ReturnType<typeof createClient>): Promise<HoorinConfig> {
  if (hooringConfigCache && hooringConfigCache.expiresAt > Date.now()) return hooringConfigCache.value;
  if (hooringConfigInFlight) return hooringConfigInFlight;

  hooringConfigInFlight = (async () => {
    const { data: row, error: rowError } = await admin.from("integrations").select("config,is_active").eq("name", "all_api_hoorin").maybeSingle();
    if (rowError) return { configured: true, endpoint: "", apiKey: "", error: rowError.message };
    const cfg = (row?.config ?? {}) as JsonRecord;
    const endpoint = String(cfg.endpoint ?? "https://dash.hoorin.com/api/courier/api").trim();
    const apiKey = String(cfg.api_key ?? "").trim();
    const value = { configured: Boolean(row?.is_active && apiKey), endpoint, apiKey, error: null };
    hooringConfigCache = { expiresAt: Date.now() + CONFIG_CACHE_TTL_MS, value };
    return value;
  })();

  try {
    return await hooringConfigInFlight;
  } finally {
    hooringConfigInFlight = null;
  }
}

function summariesOf(payload: unknown): JsonRecord {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as JsonRecord;
  const candidate = root.Summaries ?? root.summaries ?? root.courierData ?? root.data ?? root;
  return candidate && typeof candidate === "object" ? candidate as JsonRecord : {};
}

function parseStats(payload: unknown): CourierStat[] {
  const summaries = summariesOf(payload);
  const out: CourierStat[] = [];
  for (const [key, val] of Object.entries(summaries)) {
    if (!val || typeof val !== "object") continue;
    const v = val as JsonRecord;
    const inner = (v.summary && typeof v.summary === "object" ? v.summary : v) as JsonRecord;
    const total = num(inner["Total Parcels"] ?? inner["Total Delivery"] ?? inner.total_parcel ?? inner.total ?? inner.totalParcel);
    const success = num(inner["Delivered Parcels"] ?? inner["Successful Delivery"] ?? inner.success_parcel ?? inner.success ?? inner.delivered);
    const cancelled = num(inner["Canceled Parcels"] ?? inner["Canceled Delivery"] ?? inner["Cancelled Parcels"] ?? inner.cancelled_parcel ?? inner.cancel ?? inner.cancelled);
    out.push({ name: pretty(key), total, success, cancelled });
  }
  return sortStats(out);
}

function sortStats(stats: CourierStat[]) {
  return [...stats].sort((a, b) => {
    const ai = COURIER_ORDER.findIndex((name) => name.toLowerCase() === a.name.toLowerCase());
    const bi = COURIER_ORDER.findIndex((name) => name.toLowerCase() === b.name.toLowerCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return b.total - a.total;
  });
}

function steadfastProviderIssue(payload: unknown): string | null {
  const summaries = summariesOf(payload);
  for (const [key, value] of Object.entries(summaries)) {
    if (!key.toLowerCase().includes("steadfast") || !value || typeof value !== "object") continue;
    const v = value as JsonRecord;
    const details = v.Details ?? v.details ?? (v.summary && typeof v.summary === "object" ? (v.summary as JsonRecord).Details ?? (v.summary as JsonRecord).details : null);
    const text = Array.isArray(details) ? details.map(String).join(" | ") : details == null ? "" : String(details);
    if (/429|packzy|rate.?limit|too many requests|error|fail|unavailable/i.test(text)) return text || "Steadfast provider unavailable";
  }
  return null;
}

function parseDirectSteadfast(payload: unknown): CourierStat | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as JsonRecord;
  const data = root.data && typeof root.data === "object" ? root.data as JsonRecord : root;
  const total = num(data.total_parcels ?? data.totalParcel ?? data.total ?? data["Total Parcels"]);
  const success = num(data.total_delivered ?? data.delivered_parcels ?? data.totalDelivered ?? data.delivered ?? data["Delivered Parcels"]);
  const explicitCancelled = data.total_cancelled ?? data.total_canceled ?? data.cancelled_parcels ?? data.canceled_parcels ?? data.cancelled ?? data.canceled;
  const cancelled = explicitCancelled == null ? Math.max(0, total - success) : num(explicitCancelled);
  if (total === 0 && success === 0 && cancelled === 0) {
    const hasKnownField = ["total_parcels", "totalParcel", "total", "Total Parcels"].some((k) => Object.prototype.hasOwnProperty.call(data, k));
    if (!hasKnownField) return null;
  }
  return { name: "Steadfast", total, success, cancelled };
}

async function loadDirectSteadfast(admin: ReturnType<typeof createClient>, phone: string): Promise<{ stat: CourierStat | null; error: string | null }> {
  const { data: rows, error } = await admin
    .from("integrations")
    .select("name,config,is_active")
    .in("name", ["all_api_steadfast", "all_api_steadfast_2"])
    .eq("is_active", true);
  if (error) return { stat: null, error: error.message };

  const ordered = [...(rows ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  const failures: string[] = [];
  for (const row of ordered) {
    const cfg = (row.config ?? {}) as JsonRecord;
    const apiKey = String(cfg.api_key ?? "").trim();
    const secretKey = String(cfg.secret_key ?? "").trim();
    const baseUrl = String(cfg.base_url ?? "https://portal.packzy.com/api/v1").trim().replace(/\/+$/, "");
    if (!apiKey || !secretKey) continue;
    try {
      const res = await fetch(`${baseUrl}/fraud_check/${encodeURIComponent(phone)}`, {
        method: "GET",
        headers: { Accept: "application/json", "content-type": "application/json", "api-key": apiKey, "secret-key": secretKey },
      });
      const text = await res.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { /* keep null */ }
      if (!res.ok) { failures.push(`${row.name}: HTTP ${res.status}`); continue; }
      const stat = parseDirectSteadfast(payload);
      if (stat) return { stat, error: null };
      failures.push(`${row.name}: invalid score response`);
    } catch (e) {
      failures.push(`${row.name}: ${e instanceof Error ? e.message : "network error"}`);
    }
  }
  return { stat: null, error: failures.join(" | ") || "No active Steadfast fallback credential" };
}

async function resolveHistory(admin: ReturnType<typeof createClient>, phone: string): Promise<HistoryResult> {
  const cfg = await getHoorinConfig(admin);
  if (cfg.error) return { configured: true, stats: [], error: cfg.error };
  if (!cfg.configured) return { configured: false, stats: [], error: null };

  try {
    const res = await fetch(`${cfg.endpoint}?apiKey=${encodeURIComponent(cfg.apiKey)}&searchTerm=${encodeURIComponent(phone)}`, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch { /* keep null */ }
    if (!res.ok) return { configured: true, stats: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` };

    let stats = parseStats(payload);
    const providerIssue = steadfastProviderIssue(payload);
    if (providerIssue) {
      const direct = await loadDirectSteadfast(admin, phone);
      if (direct.stat) {
        stats = sortStats([...stats.filter((s) => s.name.toLowerCase() !== "steadfast"), direct.stat]);
        return { configured: true, stats, error: null, steadfast_source: "direct_fallback" };
      }
      stats = stats.filter((s) => s.name.toLowerCase() !== "steadfast");
      return { configured: true, stats, error: `Steadfast temporarily unavailable (${providerIssue}). Direct fallback also failed: ${direct.error ?? "unknown error"}` };
    }

    return { configured: true, stats, error: null, steadfast_source: "hoorin" };
  } catch (e) {
    return { configured: true, stats: [], error: e instanceof Error ? e.message : "Network error" };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const access = await authorize(admin, token);
  if (!access.authorized) return json({ error: "Unauthorized" }, 403);

  let body: JsonRecord;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 6 || phone.length > 20) return json({ error: "Invalid phone" }, 400);

  const cacheKey = phone;
  const memoryCached = readHistoryCache(cacheKey);
  if (memoryCached) return json(memoryCached);

  const persistent = await readPersistentCache(admin, phone);
  if (persistent?.fresh) {
    writeHistoryCache(cacheKey, persistent.result);
    return json(persistent.result);
  }

  const existing = historyInFlight.get(cacheKey);
  if (existing) return json(await existing);

  const request = withProviderSlot(async (): Promise<HistoryResult> => {
    const beforeSlot = await readPersistentCache(admin, phone);
    if (beforeSlot?.fresh) return beforeSlot.result;

    const waitMs = await reserveGlobalProviderSlot(admin);
    if (waitMs > 0) await sleep(waitMs);

    const afterSlot = await readPersistentCache(admin, phone);
    if (afterSlot?.fresh) return afterSlot.result;

    const result = await resolveHistory(admin, phone);
    if (result.configured && !result.error) {
      await writePersistentSuccess(admin, phone, result);
      return result;
    }

    const stale = afterSlot ?? beforeSlot ?? persistent;
    if (result.error && stale?.result.configured && !stale.result.error) {
      await extendPersistentStale(admin, phone);
      return { ...stale.result, error: null, stale: true };
    }
    return result;
  });

  historyInFlight.set(cacheKey, request);
  try {
    const result = await request;
    writeHistoryCache(cacheKey, result);
    return json(result);
  } finally {
    historyInFlight.delete(cacheKey);
  }
});
