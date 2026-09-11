import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Row = Record<string, unknown>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const str = (value: unknown) => String(value ?? "").trim();

function normalizeStatus(value: string) {
  return value.toLowerCase().trim().replace(/&/g, "and").replace(/[\s-]+/g, "_");
}

function mapCourierStatus(value: string): "delivered" | "partial" | "pending_return" | "returned" | "cancelled" | "shipped" | null {
  const v = normalizeStatus(value);
  if (!v) return null;
  if (v === "delivered" || v.includes("delivered_successfully")) return "delivered";
  if (v === "partial" || v.startsWith("partial_") || v.includes("partially_delivered") || v.includes("partially_cancelled")) return "partial";
  if (v.includes("cancellation_request") || v.includes("cancel_request") || v.includes("cancellation_pending") || v.includes("cancel_pending") || v.includes("return_pending") || v.includes("return_process") || v === "pending_return") return "pending_return";
  if (v === "returned" || v === "return" || v === "rto" || v.startsWith("return_") || v.startsWith("rto_") || v.includes("reversed_back") || v.includes("return_to_sender") || v.includes("returned_to_sender") || v.includes("return_to_merchant")) return "returned";
  if (v === "cancelled" || v === "canceled" || v.startsWith("cancelled_") || v.startsWith("canceled_")) return "cancelled";
  return "shipped";
}

async function callSteadfast(consignment: string, cfg: Row) {
  const base = str(cfg.base_url) || "https://portal.packzy.com/api/v1";
  const apiKey = str(cfg.api_key);
  const secretKey = str(cfg.secret_key);
  if (!apiKey || !secretKey) return null;
  const response = await fetch(`${base.replace(/\/$/, "")}/status_by_cid/${encodeURIComponent(consignment)}`, {
    headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as Row | null;
  return str(payload?.delivery_status ?? payload?.status_text);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "Server configuration missing" }, 500);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const cronSecret = req.headers.get("x-courier-sync-secret") ?? "";
  const { data: secretRow } = await admin.from("system_job_secrets").select("secret").eq("name", "steadfast_status_sync").maybeSingle();
  if (!secretRow?.secret || cronSecret !== secretRow.secret) return json({ error: "Unauthorized" }, 401);

  const { data: integrations, error: integrationError } = await admin.from("integrations").select("name,config").eq("is_active", true).in("name", ["all_api_steadfast", "all_api_steadfast_2"]);
  if (integrationError) return json({ error: integrationError.message }, 500);
  const configs = (integrations ?? []).map((row: Row) => (row.config ?? {}) as Row).filter((cfg: Row) => str(cfg.api_key) && str(cfg.secret_key));
  if (!configs.length) return json({ updated: 0, checked: 0, error: "Steadfast not configured" });

  const { data: orders, error: orderError } = await admin.from("orders").select("id,status,courier_consignment").eq("status", "shipped").not("courier_consignment", "is", null).limit(200);
  if (orderError) return json({ error: orderError.message }, 500);

  let checked = 0;
  let updated = 0;
  let unchanged = 0;
  for (const order of orders ?? []) {
    const consignment = str(order.courier_consignment);
    if (!consignment) continue;
    let courierStatus = "";
    for (const cfg of configs) {
      try {
        courierStatus = await callSteadfast(consignment, cfg) ?? "";
        if (courierStatus) break;
      } catch {
        // Try the next configured Steadfast account.
      }
    }
    if (!courierStatus) continue;
    checked++;
    const mapped = mapCourierStatus(courierStatus);
    if (!mapped) continue;

    const patch: Row = { courier_status: courierStatus, updated_at: new Date().toISOString() };
    if (mapped !== "shipped") patch.status = mapped;
    const { error } = await admin.from("orders").update(patch).eq("id", order.id).eq("status", "shipped");
    if (error) {
      console.error("[steadfast-status-sync] update failed", order.id, error.message);
      continue;
    }
    if (mapped === "shipped") unchanged++;
    else updated++;
  }
  return json({ status: "success", checked, updated, unchanged });
});
