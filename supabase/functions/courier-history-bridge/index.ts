import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type CourierStat = { name: string; total: number; success: number; cancelled: number };
const COURIER_ORDER = ["Steadfast", "Pathao", "RedX", "Paperfly", "Carrybee", "eCourier"];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const num = (x: unknown) => { const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : 0; };
const pretty = (s: string) => s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
function parseStats(payload: unknown): CourierStat[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const summaries = (root.Summaries ?? root.summaries ?? root.courierData ?? root.data ?? root) as Record<string, unknown>;
  const out: CourierStat[] = [];
  for (const [key, val] of Object.entries(summaries)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    const inner = ((v.summary as Record<string, unknown>) || v) as Record<string, unknown>;
    const total = num(inner["Total Parcels"] ?? inner["Total Delivery"] ?? inner.total_parcel ?? inner.total ?? inner.totalParcel);
    const success = num(inner["Delivered Parcels"] ?? inner["Successful Delivery"] ?? inner.success_parcel ?? inner.success ?? inner.delivered);
    const cancelled = num(inner["Canceled Parcels"] ?? inner["Canceled Delivery"] ?? inner["Cancelled Parcels"] ?? inner.cancelled_parcel ?? inner.cancel ?? inner.cancelled);
    out.push({ name: pretty(key), total, success, cancelled });
  }
  return out.sort((a, b) => {
    const ai = COURIER_ORDER.findIndex((name) => name.toLowerCase() === a.name.toLowerCase());
    const bi = COURIER_ORDER.findIndex((name) => name.toLowerCase() === b.name.toLowerCase());
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return b.total - a.total;
  });
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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length < 6 || phone.length > 20) return json({ error: "Invalid phone" }, 400);

  const { data: row, error: rowError } = await admin.from("integrations").select("config,is_active").eq("name", "all_api_hoorin").maybeSingle();
  if (rowError) return json({ error: rowError.message }, 500);
  const cfg = (row?.config ?? {}) as Record<string, unknown>;
  const endpoint = String(cfg.endpoint ?? "https://dash.hoorin.com/api/courier/api").trim();
  const apiKey = String(cfg.api_key ?? "").trim();
  if (!row?.is_active || !apiKey) return json({ configured: false, stats: [], error: null });

  try {
    const res = await fetch(`${endpoint}?apiKey=${encodeURIComponent(apiKey)}&searchTerm=${encodeURIComponent(phone)}`, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch { /* keep null */ }
    if (!res.ok) return json({ configured: true, stats: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
    return json({ configured: true, stats: parseStats(payload), error: null });
  } catch (e) {
    return json({ configured: true, stats: [], error: e instanceof Error ? e.message : "Network error" });
  }
});
