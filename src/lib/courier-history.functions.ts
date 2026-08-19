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

const COURIER_ORDER = ["Steadfast", "Pathao", "RedX", "Paperfly", "Carrybee", "eCourier"];

// Short-lived server-side cache: refreshing an order section must not call
// the external courier API again for the same phone every time.
const CACHE_TTL_MS = 5 * 60 * 1000;
const courierCache = new Map<string, { expiresAt: number; result: { configured: boolean; stats: CourierStat[]; error: string | null } }>();
const inFlight = new Map<string, Promise<{ configured: boolean; stats: CourierStat[]; error: string | null }>>();

// Fetches per-courier delivery history for a phone number using the
// Hoorin Courier Search API (https://dash.hoorin.com).
// Config is stored in `integrations` row with name = "all_api_hoorin".
export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ phone: z.string().min(6).max(20) }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const phone = data.phone.replace(/\D/g, "");
    const cached = courierCache.get(phone);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const existing = inFlight.get(phone);
    if (existing) return existing;

    const request = loadCourierHistory(phone);
    inFlight.set(phone, request);
    try {
      const result = await request;
      if (result.configured && !result.error) {
        courierCache.set(phone, { expiresAt: Date.now() + CACHE_TTL_MS, result });
      }
      return result;
    } finally {
      inFlight.delete(phone);
    }
  });

async function loadCourierHistory(phone: string): Promise<{ configured: boolean; stats: CourierStat[]; error: string | null }> {
  const { data: row } = await supabaseAdmin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "all_api_hoorin")
    .maybeSingle();

  const cfg = (row?.config as Record<string, string>) || {};
  const endpoint = (cfg.endpoint || "https://dash.hoorin.com/api/courier/api").trim();
  const apiKey = (cfg.api_key || "").trim();
  if (!apiKey) return { configured: false, stats: [], error: null };

  const url = `${endpoint}?apiKey=${encodeURIComponent(apiKey)}&searchTerm=${encodeURIComponent(phone)}`;
  try {
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* keep null */ }
    if (!res.ok) return { configured: true, stats: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    return { configured: true, stats: parseStats(json), error: null };
  } catch (e) {
    return { configured: true, stats: [], error: e instanceof Error ? e.message : "Network error" };
  }
}

function parseStats(json: unknown): CourierStat[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
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

function num(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}
function pretty(s: string) {
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
