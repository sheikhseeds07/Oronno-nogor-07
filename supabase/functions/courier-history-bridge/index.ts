import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type CourierStat = { name: string; total: number; success: number; cancelled: number };
type JsonRecord = Record<string, unknown>;
type HistoryResult = { configured: boolean; stats: CourierStat[]; overall?: CourierStat; error: string | null; stale?: boolean; source?: string };
type PersistentHit = { result: HistoryResult; fresh: boolean };

const SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_TTL_MS = 20 * 1000;
const STALE_CACHE_TTL_MS = 30 * 60 * 1000;
const AUTHZ_CACHE_TTL_MS = 5 * 60 * 1000;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_PROVIDER_GAP_MS = 120;
const HOORIN_TIMEOUT_MS = 7_000;
const HOORIN_ENDPOINT = "https://plugin.hoorin.com/courier/api/v1/search";
const MAX_CACHE_ENTRIES = 3000;

const historyCache = new Map<string, { expiresAt: number; result: HistoryResult }>();
const inFlight = new Map<string, Promise<HistoryResult>>();
const persistentReadCache = new Map<string, { expiresAt: number; hit: PersistentHit | null }>();
const persistentReadInFlight = new Map<string, Promise<PersistentHit | null>>();
const PERSISTENT_READ_TTL_MS = 30_000;
const authzCache = new Map<string, { expiresAt: number; authorized: boolean }>();
let configCache: { expiresAt: number; value: { configured: boolean; endpoint: string; apiKey: string; error: string | null } } | null = null;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const pretty = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function readMemory(key: string): HistoryResult | null {
  const hit = historyCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) { historyCache.delete(key); return null; }
  return hit.result;
}

function writeMemory(key: string, result: HistoryResult) {
  const now = Date.now();
  for (const [k, v] of historyCache) if (v.expiresAt <= now) historyCache.delete(k);
  while (historyCache.size >= MAX_CACHE_ENTRIES) {
    const first = historyCache.keys().next().value as string | undefined;
    if (!first) break;
    historyCache.delete(first);
  }
  const ttl = result.stale ? STALE_CACHE_TTL_MS : result.error ? FAILURE_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS;
  historyCache.set(key, { expiresAt: now + ttl, result });
}

async function authorize(admin: ReturnType<typeof createClient>, token: string): Promise<boolean> {
  const cached = authzCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.authorized;
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return false;
  const [{ data: roles }, { data: perms }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", user.id),
    admin.from("employee_permissions").select("orders").eq("user_id", user.id).maybeSingle(),
  ]);
  const names = new Set((roles ?? []).map((r) => String(r.role)));
  const authorized = names.has("admin") || names.has("super_admin") || Boolean(perms?.orders);
  if (authorized) authzCache.set(token, { expiresAt: Date.now() + AUTHZ_CACHE_TTL_MS, authorized: true });
  return authorized;
}

async function getHoorinConfig(admin: ReturnType<typeof createClient>) {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  const { data, error } = await admin.from("integrations").select("config,is_active").eq("name", "all_api_hoorin").maybeSingle();
  if (error) return { configured: true, endpoint: "", apiKey: "", error: error.message };
  const cfg = (data?.config ?? {}) as JsonRecord;
  const rawEndpoint = String(cfg.endpoint ?? "").trim();
  // Legacy dash.hoorin.com summary endpoint returns stale/placeholder RedX numbers (10/6/4)
  // for every phone. Always use Hoorin's current v1 search endpoint.
  const legacy = !rawEndpoint || /dash\.hoorin\.com/i.test(rawEndpoint) || !/\/v1\/search/i.test(rawEndpoint);
  const endpoint = legacy ? HOORIN_ENDPOINT : rawEndpoint;
  const value = { configured: Boolean(data?.is_active && String(cfg.api_key ?? "").trim()), endpoint, apiKey: String(cfg.api_key ?? "").trim(), error: null as string | null };
  configCache = { expiresAt: Date.now() + CONFIG_CACHE_TTL_MS, value };
  return value;
}

const COURIER_KEY_RE = /^(steadfast|steadfastcourier|redx|redex|redxbd|pathao|pathaocourier|carrybee|paperfly|ecourier|sundarban|sundarbancourier)$/;
const SKIP_KEY_RE = /^(data|summary|summaries|courierdata|couriers|courier|root|total|totals|overall|meta|result|response|payload|info|status|message|report|reports|details)$/;
const COUNT_KEYS = [
  "Total Parcels","Total Delivery","total_parcel","totalParcel","total","total_parcel_count","Total_parcels","total_parcels","totalParcelCount",
  "Delivered Parcels","Successful Delivery","success_parcel","successParcel","success","delivered","delivered_parcel","delivered_parcels","total_delivered","delivered_count",
  "Canceled Parcels","Canceled Delivery","Cancelled Parcels","cancelled_parcel","cancelled_parcels","canceled_parcels","cancelledParcel","cancel","cancelled","total_cancelled","cancelled_count",
];

function prettyCourier(normalizedKey: string, fallback: string) {
  const map: Record<string, string> = {
    steadfast: "Steadfast", steadfastcourier: "Steadfast",
    redx: "RedX", redex: "RedX", redxbd: "RedX",
    pathao: "Pathao", pathaocourier: "Pathao",
    carrybee: "Carrybee", paperfly: "Paperfly", ecourier: "eCourier",
    sundarban: "Sundarban", sundarbancourier: "Sundarban",
  };
  return map[normalizedKey] ?? fallback;
}

function parseStats(payload: unknown): CourierStat[] {
  if (!payload || typeof payload !== "object") return [];
  const found = new Map<string, CourierStat>();

  const visit = (key: string, value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          const row = entry as JsonRecord;
          const rowName = typeof row.name === "string" ? row.name : typeof row.courier === "string" ? row.courier : key;
          visit(String(rowName), row, depth + 1);
        }
      }
      return;
    }

    const row = value as JsonRecord;
    const inner = row.summary && typeof row.summary === "object" && !Array.isArray(row.summary) ? row.summary as JsonRecord : row;
    const total = num(inner["Total Parcels"] ?? inner["Total Delivery"] ?? inner.total_parcel ?? inner.totalParcel ?? inner.total ?? inner["total_parcel_count"] ?? inner.Total_parcels ?? inner.total_parcels ?? inner.totalParcelCount);
    const success = num(inner["Delivered Parcels"] ?? inner["Successful Delivery"] ?? inner.delivered_parcels ?? inner.success_parcel ?? inner.successParcel ?? inner.success ?? inner.delivered ?? inner["delivered_parcel"] ?? inner.total_delivered ?? inner.delivered_count);
    const cancelled = num(inner["Canceled Parcels"] ?? inner["Canceled Delivery"] ?? inner["Cancelled Parcels"] ?? inner.cancelled_parcels ?? inner.canceled_parcels ?? inner.cancelled_parcel ?? inner.cancelledParcel ?? inner.cancel ?? inner.cancelled ?? inner["cancelled_parcel"] ?? inner.total_cancelled ?? inner.cancelled_count);
    const hasCounts = COUNT_KEYS.some((k) => Object.prototype.hasOwnProperty.call(inner, k));

    const rawName = typeof inner.name === "string" && inner.name.trim() ? inner.name.trim() : key;
    const normalizedKey = String(rawName).replace(/[\s_-]/g, "").toLowerCase();
    const isCourier = COURIER_KEY_RE.test(normalizedKey);

    if ((isCourier || hasCounts) && !SKIP_KEY_RE.test(normalizedKey)) {
      const name = prettyCourier(normalizedKey, pretty(String(rawName)));
      const id = name.toLowerCase();
      const prev = found.get(id);
      if (!prev || total > prev.total || (total === prev.total && success > prev.success)) {
        found.set(id, { name, total, success, cancelled });
      }
    }

    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === "object") visit(k, v, depth + 1);
    }
  };

  visit("root", payload, 0);
  return Array.from(found.values())
    .filter((s) => COURIER_KEY_RE.test(s.name.replace(/[\s_-]/g, "").toLowerCase()) || s.total > 0 || s.success > 0 || s.cancelled > 0)
    .sort((a, b) => b.total - a.total);
}

async function readPersistent(admin: ReturnType<typeof createClient>, phone: string): Promise<PersistentHit | null> {
  const cached = persistentReadCache.get(phone);
  if (cached && cached.expiresAt > Date.now()) return cached.hit;
  if (cached) persistentReadCache.delete(phone);

  const existing = persistentReadInFlight.get(phone);
  if (existing) return existing;

  const request = (async (): Promise<PersistentHit | null> => {
    const { data, error } = await admin.from("courier_history_cache").select("configured,stats,error,expires_at").eq("phone", phone).maybeSingle();
    if (error || !data) return null;
    const rawStats = Array.isArray(data.stats) ? data.stats as CourierStat[] : [];
    const overall = rawStats.find((row) => String(row.name).toLowerCase() === "overall");
    const result: HistoryResult = {
      configured: Boolean(data.configured),
      stats: rawStats.filter((row) => String(row.name).toLowerCase() !== "overall"),
      overall,
      error: typeof data.error === "string" ? data.error : null,
      source: "cache",
    };
    const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
    return { result, fresh: Number.isFinite(expiresAt) && expiresAt > Date.now() };
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

async function writePersistent(admin: ReturnType<typeof createClient>, phone: string, result: HistoryResult) {
  if (!result.configured || result.error || result.stats.length === 0) return;
  const now = Date.now();
  const persistedStats = result.overall ? [...result.stats, result.overall] : result.stats;
  await admin.from("courier_history_cache").upsert({ phone, configured: true, stats: persistedStats, error: null, steadfast_source: "hoorin", fetched_at: new Date(now).toISOString(), expires_at: new Date(now + SUCCESS_CACHE_TTL_MS).toISOString() }, { onConflict: "phone" });
}

async function reserveProviderSlot(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.rpc("reserve_courier_provider_slot", { p_gap_ms: GLOBAL_PROVIDER_GAP_MS });
  if (error) return 0;
  const wait = Number(data ?? 0);
  return Number.isFinite(wait) ? Math.max(0, Math.min(wait, 2_500)) : 0;
}

function parseOverall(payload: unknown): CourierStat | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const row = (payload as JsonRecord).overall;
  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const value = row as JsonRecord;
  const total = num(value.total_parcels ?? value.total_parcel ?? value.total);
  const success = num(value.delivered_parcels ?? value.delivered ?? value.success);
  const cancelled = num(value.cancelled_parcels ?? value.cancelled ?? value.cancel);
  if (total <= 0 && success <= 0 && cancelled <= 0) return undefined;
  return { name: "Overall", total, success, cancelled };
}

async function fetchHoorin(admin: ReturnType<typeof createClient>, phone: string): Promise<HistoryResult> {
  const cfg = await getHoorinConfig(admin);
  if (cfg.error) return { configured: true, stats: [], error: cfg.error };
  if (!cfg.configured) return { configured: false, stats: [], error: null };
  let lastError = "Hoorin request failed";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HOORIN_TIMEOUT_MS);
    try {
      const separator = cfg.endpoint.includes("?") ? "&" : "?";
      const res = await fetch(`${cfg.endpoint}${separator}apiKey=${encodeURIComponent(cfg.apiKey)}&searchTerm=${encodeURIComponent(phone)}&view=full&cache=off`, { method: "GET", headers: { Accept: "application/json", "Cache-Control": "no-cache" }, signal: controller.signal });
      const text = await res.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { payload = null; }
      if (res.ok) {
        const stats = parseStats(payload);
        const overall = parseOverall(payload);
        return { configured: true, stats, overall, error: null, source: "hoorin" };
      }
      lastError = `Hoorin HTTP ${res.status}`;
      if (attempt < 2 && (res.status === 429 || res.status >= 500)) { await sleep(300 * (attempt + 1)); continue; }
      return { configured: true, stats: [], error: lastError };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Hoorin network error";
      if (attempt < 2) { await sleep(250 * (attempt + 1)); continue; }
    } finally { clearTimeout(timeout); }
  }
  return { configured: true, stats: [], error: lastError };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!await authorize(admin, token)) return json({ error: "Unauthorized" }, 403);
  let body: JsonRecord;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 6 || phone.length > 20) return json({ error: "Invalid phone" }, 400);
  const forceRefresh = body.forceRefresh === true;
  const memory = readMemory(phone);
  if (!forceRefresh && memory && !memory.error && memory.stats.length > 0) return json(memory);
  const persistent = await readPersistent(admin, phone);
  if (!forceRefresh && persistent?.fresh && !persistent.result.error && persistent.result.stats.length > 0) { writeMemory(phone, persistent.result); return json(persistent.result); }
  const existing = inFlight.get(phone);
  if (existing) return json(await existing);
  const request = (async (): Promise<HistoryResult> => {
    const waitMs = await reserveProviderSlot(admin);
    if (waitMs > 0) await sleep(waitMs);
    const afterWait = await readPersistent(admin, phone);
    if (!forceRefresh && afterWait?.fresh && !afterWait.result.error && afterWait.result.stats.length > 0) return afterWait.result;
    const result = await fetchHoorin(admin, phone);
    if (!result.error && result.stats.length > 0) {
      const live = { ...result };
      await writePersistent(admin, phone, live);
      return live;
    }
    if (!result.error && result.stats.length === 0) return { configured: true, stats: [], error: "Hoorin returned no courier history" };
    return result;
  })();
  inFlight.set(phone, request);
  try { const result = await request; writeMemory(phone, result); return json(result); } finally { inFlight.delete(phone); }
});