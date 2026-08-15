import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
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

// Fetches per-courier delivery history for a phone number using the
// Hoorin Courier Search API (https://dash.hoorin.com).
// Config is stored in `integrations` row with name = "all_api_hoorin".
export const fetchCourierHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ phone: z.string().min(6).max(20) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: row } = await supabaseAdmin
      .from("integrations")
      .select("config,is_active")
      .eq("name", "all_api_hoorin")
      .maybeSingle();

    const cfg = (row?.config as Record<string, string>) || {};
    const endpoint = (cfg.endpoint || "https://dash.hoorin.com/api/courier/api").trim();
    const apiKey = (cfg.api_key || "").trim();
    if (!apiKey) {
      return { configured: false, stats: [] as CourierStat[], error: null as string | null };
    }

    const phone = data.phone.replace(/\D/g, "");
    const url = `${endpoint}?apiKey=${encodeURIComponent(apiKey)}&searchTerm=${encodeURIComponent(phone)}`;
    try {
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      const text = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(text); } catch { /* keep null */ }
      if (!res.ok) {
        return { configured: true, stats: [] as CourierStat[], error: `HTTP ${res.status}: ${text.slice(0, 200)}` as string | null };
      }
      return { configured: true, stats: parseStats(json), error: null as string | null };
    } catch (e) {
      return { configured: true, stats: [] as CourierStat[], error: (e instanceof Error ? e.message : "Network error") as string | null };
    }
  });

function parseStats(json: unknown): CourierStat[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const summaries = (root.Summaries ?? root.summaries ?? root.courierData ?? root.data ?? root) as Record<string, unknown>;
  const out: CourierStat[] = [];
  for (const [key, val] of Object.entries(summaries)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    const inner = ((v.summary as Record<string, unknown>) || v) as Record<string, unknown>;
    const total = num(
      inner["Total Parcels"] ?? inner["Total Delivery"] ?? inner.total_parcel ?? inner.total ?? inner.totalParcel,
    );
    const success = num(
      inner["Delivered Parcels"] ?? inner["Successful Delivery"] ?? inner.success_parcel ?? inner.success ?? inner.delivered,
    );
    const cancelled = num(
      inner["Canceled Parcels"] ?? inner["Canceled Delivery"] ?? inner["Cancelled Parcels"] ?? inner.cancelled_parcel ?? inner.cancel ?? inner.cancelled,
    );
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
