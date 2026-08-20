import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type CourierStat = { name: string; total: number; success: number; cancelled: number };
type JsonRecord = Record<string, unknown>;
const COURIER_ORDER = ["Steadfast", "Pathao", "RedX", "Paperfly", "Carrybee", "eCourier"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const num = (x: unknown) => { const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : 0; };
const pretty = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
          "api-key": apiKey,
          "secret-key": secretKey,
        },
      });
      const text = await res.text();
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch { /* keep null */ }
      if (!res.ok) {
        failures.push(`${row.name}: HTTP ${res.status}`);
        continue;
      }
      const stat = parseDirectSteadfast(payload);
      if (stat) return { stat, error: null };
      failures.push(`${row.name}: invalid score response`);
    } catch (e) {
      failures.push(`${row.name}: ${e instanceof Error ? e.message : "network error"}`);
    }
  }
  return { stat: null, error: failures.join(" | ") || "No active Steadfast fallback credential" };
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
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const [{ data: roles }, { data: perms }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", user.id),
    admin.from("employee_permissions").select("orders").eq("user_id", user.id).maybeSingle(),
  ]);
  const roleNames = new Set((roles ?? []).map((r) => String(r.role)));
  if (!roleNames.has("admin") && !roleNames.has("super_admin") && !perms?.orders) return json({ error: "Unauthorized" }, 403);

  let body: JsonRecord;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 6 || phone.length > 20) return json({ error: "Invalid phone" }, 400);

  const { data: row, error: rowError } = await admin.from("integrations").select("config,is_active").eq("name", "all_api_hoorin").maybeSingle();
  if (rowError) return json({ error: rowError.message }, 500);
  const cfg = (row?.config ?? {}) as JsonRecord;
  const endpoint = String(cfg.endpoint ?? "https://dash.hoorin.com/api/courier/api").trim();
  const apiKey = String(cfg.api_key ?? "").trim();
  if (!row?.is_active || !apiKey) return json({ configured: false, stats: [], error: null });

  try {
    const res = await fetch(`${endpoint}?apiKey=${encodeURIComponent(apiKey)}&searchTerm=${encodeURIComponent(phone)}`, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch { /* keep null */ }
    if (!res.ok) return json({ configured: true, stats: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` });

    let stats = parseStats(payload);
    const providerIssue = steadfastProviderIssue(payload);
    if (providerIssue) {
      const direct = await loadDirectSteadfast(admin, phone);
      if (direct.stat) {
        stats = sortStats([...stats.filter((s) => s.name.toLowerCase() !== "steadfast"), direct.stat]);
        return json({ configured: true, stats, error: null, steadfast_source: "direct_fallback" });
      }
      stats = stats.filter((s) => s.name.toLowerCase() !== "steadfast");
      return json({ configured: true, stats, error: `Steadfast temporarily unavailable (${providerIssue}). Direct fallback also failed: ${direct.error ?? "unknown error"}` });
    }

    return json({ configured: true, stats, error: null, steadfast_source: "hoorin" });
  } catch (e) {
    return json({ configured: true, stats: [], error: e instanceof Error ? e.message : "Network error" });
  }
});
