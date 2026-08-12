import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders, assertIsAdmin } from "@/lib/_admin-guard.server";
import { ensureOrderInvoiceNo } from "@/lib/invoice-no.server";


async function callSteadfast(path: string, cfg: Record<string, string>, body?: unknown) {
  const base = (cfg.base_url || "https://portal.packzy.com/api/v1").trim();
  const apiKey = (cfg.api_key || "").trim();
  const secretKey = (cfg.secret_key || "").trim();
  if (!apiKey || !secretKey) {
    return { ok: false, status: 0, body: "API Key এবং Secret Key দুটোই দিতে হবে", json: null as unknown };
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(12000),
    headers: {
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep */ }
  return { ok: res.ok, status: res.status, body: text.slice(0, 400), json };
}

// Bulk-send selected orders to Steadfast
export const sendOrdersToSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderIds: z.array(z.string().uuid()).min(1).max(50) }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: rows } = await supabaseAdmin
      .from("integrations")
      .select("name,config,is_active")
      .in("name", ["all_api_steadfast", "courier_steadfast"]);
    const row = (rows ?? []).find((r) => r.name === "all_api_steadfast" && r.is_active) ?? (rows ?? []).find((r) => r.is_active) ?? (rows ?? [])[0];
    const cfg = (row?.config as Record<string, string>) || {};
    if (!cfg.api_key || !cfg.secret_key) return { results: [], error: "Steadfast API key/secret সেভ করা নেই" };

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id,invoice_no,customer_name,customer_phone,customer_address,thana,district,total,courier_consignment")
      .in("id", data.orderIds);

    // Product names for the courier "note" (item description) — one query for all orders
    const { data: itemRows } = await supabaseAdmin
      .from("order_items")
      .select("order_id,product_name,quantity")
      .in("order_id", data.orderIds);
    const itemsByOrder = new Map<string, string[]>();
    for (const it of itemRows ?? []) {
      const list = itemsByOrder.get(it.order_id) ?? [];
      list.push(`${it.product_name} x${it.quantity}`);
      itemsByOrder.set(it.order_id, list);
    }


    // Deep search for a key in nested objects — handles any response shape
    const deepFind = (obj: unknown, keys: string[]): string | undefined => {
      if (!obj || typeof obj !== "object") return undefined;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (keys.includes(k)) {
          if (typeof v === "string" && v.trim()) return v.trim();
          if (typeof v === "number" && Number.isFinite(v)) return String(v);
        }
        if (v && typeof v === "object") {
          const f = deepFind(v, keys);
          if (f) return f;
        }
      }
      return undefined;
    };

    const results: { id: string; ok: boolean; consignment?: string; message: string; already?: boolean }[] = [];
    for (const o of orders ?? []) {
      if (o.courier_consignment) {
        results.push({ id: o.id, ok: false, already: true, consignment: o.courier_consignment, message: "ইতিমধ্যে এন্ট্রি হয়েছে (Already entry)" });
        continue;
      }
      // Invoice format is admin-configurable (All API → Invoice), e.g. AA1, AA2...
      const invoice = await ensureOrderInvoiceNo(o.id, o.invoice_no);

      // Dedup: ask Steadfast if invoice already exists
      try {
        const chk = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
        const existing = deepFind(chk.json, ["consignment_id", "tracking_code"]);
        if (chk.ok && existing) {
          // Save tracking but DO NOT auto-change status; keep current status
          await supabaseAdmin.from("orders").update({
            courier_consignment: existing, courier_status: "in_review",
          }).eq("id", o.id);
          results.push({ id: o.id, ok: false, already: true, consignment: existing, message: "ইতিমধ্যে এন্ট্রি হয়েছে (Already entry)" });
          continue;
        }
      } catch { /* proceed to create */ }

      const payload = {
        invoice,
        recipient_name: o.customer_name,
        recipient_phone: (o.customer_phone || "").replace(/\D/g, "").slice(-11),
        recipient_address: [o.customer_address, o.thana, o.district].filter(Boolean).join(", "),
        cod_amount: Number(o.total) || 0,
        note: (itemsByOrder.get(o.id) ?? []).join(", ").slice(0, 240),
      };
      let r: Awaited<ReturnType<typeof callSteadfast>>;
      try {
        r = await callSteadfast("create_order", cfg, payload);
      } catch (e) {
        results.push({ id: o.id, ok: false, message: e instanceof Error ? e.message : "Steadfast network error" });
        continue;
      }
      let consignment = deepFind(r.json, ["consignment_id", "tracking_code"]);

      // If extraction failed but Steadfast may have created it, look it up by invoice
      if (!consignment) {
        try {
          const chk2 = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
          consignment = deepFind(chk2.json, ["consignment_id", "tracking_code"]);
        } catch { /* ignore */ }
      }

      if (consignment) {
        // Save tracking but DO NOT auto-change order status; user moves it manually
        await supabaseAdmin.from("orders").update({
          courier_consignment: consignment, courier_status: "in_review",
        }).eq("id", o.id);
        results.push({ id: o.id, ok: true, consignment, message: "পাঠানো হয়েছে" });
      } else {
        results.push({ id: o.id, ok: false, message: `HTTP ${r.status} — ${r.body.slice(0, 160)}` });
      }
    }
    return { results, error: null };
  });


export const testCourierConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      courier: z.enum(["steadfast"]),
      config: z.record(z.string(), z.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.userId);
    try {
      const r = await callSteadfast("get_balance", data.config);
      return {
        success: r.ok,
        status: r.status,
        message: r.ok ? "Steadfast এর সাথে কানেকশন সফল" : `ব্যর্থ (HTTP ${r.status}) — ${r.body}`,
        detail: r.body,
      };
    } catch (e) {
      return {
        success: false,
        status: 0,
        message: e instanceof Error ? e.message : "Network error",
        detail: "",
      };
    }
  });

// Fetch Steadfast current balance — reads saved config from integrations table.
export const fetchSteadfastBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageOrders(context.userId);
  const { data: row } = await supabaseAdmin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "all_api_steadfast")
    .maybeSingle();
  if (!row) return { ok: false, balance: null as number | null, message: "Steadfast সেভ করা নেই" };
  const cfg = (row.config as Record<string, string>) || {};
  try {
    const r = await callSteadfast("get_balance", cfg);
    if (!r.ok) return { ok: false, balance: null, message: `ব্যর্থ (HTTP ${r.status}) — ${r.body}` };
    const j = (r.json as Record<string, unknown>) || {};
    const bal =
      typeof j.current_balance === "number" ? j.current_balance :
      typeof j.balance === "number" ? j.balance :
      Number(j.current_balance ?? j.balance ?? NaN);
    return { ok: true, balance: Number.isFinite(bal) ? bal : null, message: "OK" };
  } catch (e) {
    return { ok: false, balance: null, message: e instanceof Error ? e.message : "Network error" };
  }
});

// Map Steadfast delivery status -> local order status
function mapSteadfastStatus(s: string): "delivered" | "partial" | "cancelled" | "hold" | "shipped" | null {
  const v = (s || "").toLowerCase();
  if (v === "delivered") return "delivered";
  if (v.startsWith("partial")) return "partial";
  if (v.startsWith("cancelled")) return "cancelled";
  if (v === "hold") return "hold";
  if (v === "in_review" || v === "pending" || v.endsWith("_approval_pending")) return "shipped";
  return null;
}

// Sync courier status for shipped orders
export const syncSteadfastStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageOrders(context.userId);
  const { data: row } = await supabaseAdmin
    .from("integrations").select("config,is_active")
    .eq("name", "all_api_steadfast").maybeSingle();
  const cfg = (row?.config as Record<string, string>) || {};
  if (!cfg.api_key || !cfg.secret_key) return { updated: 0, error: "Steadfast not configured" };

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id,courier_consignment,status")
    .eq("status", "shipped")
    .not("courier_consignment", "is", null)
    .limit(100);

  let updated = 0;
  for (const o of orders ?? []) {
    if (!o.courier_consignment) continue;
    try {
      const r = await callSteadfast(`status_by_cid/${encodeURIComponent(o.courier_consignment)}`, cfg);
      const j = (r.json as Record<string, unknown>) || {};
      const delivery = String((j.delivery_status as string) || "");
      const mapped = mapSteadfastStatus(delivery);
      if (mapped && mapped !== o.status) {
        await supabaseAdmin.from("orders").update({
          status: mapped, courier_status: delivery,
        }).eq("id", o.id);
        updated++;
      } else if (delivery) {
        await supabaseAdmin.from("orders").update({ courier_status: delivery }).eq("id", o.id);
      }
    } catch { /* skip */ }
  }
  return { updated, error: null };
});
