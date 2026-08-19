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
  if (!apiKey || !secretKey) return { ok: false, status: 0, body: "API Key এবং Secret Key দুটোই দিতে হবে", json: null as unknown };
  const res = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
    method: body ? "POST" : "GET", signal: AbortSignal.timeout(12000),
    headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* keep */ }
  return { ok: res.ok, status: res.status, body: text.slice(0, 400), json };
}

export const STEADFAST_ROW_NAME = { 1: "all_api_steadfast", 2: "all_api_steadfast_2" } as const;
const AccountSchema = z.union([z.literal(1), z.literal(2)]).optional();

async function loadSteadfastCfg(account: 1 | 2 = 1): Promise<Record<string, string>> {
  const name = STEADFAST_ROW_NAME[account];
  const names = account === 1 ? [name, "courier_steadfast"] : [name];
  const { data: rows } = await supabaseAdmin.from("integrations").select("name,config,is_active").in("name", names);
  const row = (rows ?? []).find((r) => r.name === name && r.is_active) ?? (rows ?? []).find((r) => r.is_active) ?? (rows ?? [])[0];
  return (row?.config as Record<string, string>) || {};
}

export const sendOrdersToSteadfast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderIds: z.array(z.string().uuid()).min(1).max(50), account: AccountSchema }))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const account = (data.account ?? 1) as 1 | 2;
    const cfg = await loadSteadfastCfg(account);
    if (!cfg.api_key || !cfg.secret_key) return { results: [], error: `Steadfast ${account} এর API key/secret সেভ করা নেই` };

    const { data: orders } = await supabaseAdmin.from("orders")
      .select("id,invoice_no,customer_name,customer_phone,customer_address,thana,district,total,courier_consignment")
      .in("id", data.orderIds);

    const shortName = (n: string) => (n || "").split(/[|–—(]/)[0].replace(/\s+/g, " ").trim().slice(0, 28);
    const { data: itemRows } = await supabaseAdmin.from("order_items")
      .select("order_id,product_name,quantity").in("order_id", data.orderIds);
    const itemsByOrder = new Map<string, string[]>();
    for (const it of itemRows ?? []) {
      const list = itemsByOrder.get(it.order_id) ?? [];
      list.push(`${shortName(it.product_name)} x${it.quantity}`);
      itemsByOrder.set(it.order_id, list);
    }
    const buildNote = (id: string) => {
      let note = "";
      for (const part of itemsByOrder.get(id) ?? []) {
        const next = note ? `${note}, ${part}` : part;
        if (next.length > 110) break;
        note = next;
      }
      return note.slice(0, 110);
    };

    const deepFind = (obj: unknown, keys: string[]): string | undefined => {
      if (!obj || typeof obj !== "object") return undefined;
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (keys.includes(k)) {
          if (typeof v === "string" && v.trim()) return v.trim();
          if (typeof v === "number" && Number.isFinite(v)) return String(v);
        }
        if (v && typeof v === "object") { const f = deepFind(v, keys); if (f) return f; }
      }
      return undefined;
    };

    const results: { id: string; ok: boolean; consignment?: string; message: string; already?: boolean }[] = [];
    for (const o of orders ?? []) {
      if (o.courier_consignment) {
        await supabaseAdmin.from("orders").update({ courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}` }).eq("id", o.id);
        results.push({ id: o.id, ok: false, already: true, consignment: o.courier_consignment, message: "ইতিমধ্যে এন্ট্রি হয়েছে (Already entry)" });
        continue;
      }
      const invoice = await ensureOrderInvoiceNo(o.id, o.invoice_no);
      try {
        const chk = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
        const existing = deepFind(chk.json, ["consignment_id", "tracking_code"]);
        const dstatus = deepFind(chk.json, ["delivery_status", "status_text"]);
        const known = dstatus && !/not[_\s-]?found|invalid|unknown/i.test(dstatus);
        if (chk.ok && (existing || known)) {
          await supabaseAdmin.from("orders").update({ courier_consignment: existing || invoice, courier_status: dstatus || "in_review", courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}` }).eq("id", o.id);
          results.push({ id: o.id, ok: false, already: true, consignment: existing, message: "ইতিমধ্যে এন্ট্রি হয়েছে (Already entry)" });
          continue;
        }
      } catch { /* proceed to create */ }

      const basePayload = {
        invoice,
        recipient_name: (o.customer_name || "").slice(0, 100),
        recipient_phone: (o.customer_phone || "").replace(/\D/g, "").slice(-11),
        recipient_address: [o.customer_address, o.thana, o.district].filter(Boolean).join(", ").slice(0, 240),
        cod_amount: Number(o.total) || 0,
      };
      let r: Awaited<ReturnType<typeof callSteadfast>>;
      try {
        const itemDescription = buildNote(o.id);
        r = await callSteadfast("create_order", cfg, { ...basePayload, item_description: itemDescription, note: itemDescription });
        if (!r.ok) r = await callSteadfast("create_order", cfg, { ...basePayload, item_description: itemDescription });
      } catch (e) {
        results.push({ id: o.id, ok: false, message: e instanceof Error ? e.message : "Steadfast network error" });
        continue;
      }

      let consignment = deepFind(r.json, ["consignment_id", "tracking_code"]);
      if (!consignment) {
        try {
          const chk2 = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
          consignment = deepFind(chk2.json, ["consignment_id", "tracking_code"]);
        } catch { /* ignore */ }
      }
      if (consignment) {
        await supabaseAdmin.from("orders").update({ courier_consignment: consignment, courier_status: "in_review", courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`, courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}` }).eq("id", o.id);
        results.push({ id: o.id, ok: true, consignment, message: "পাঠানো হয়েছে" });
      } else {
        results.push({ id: o.id, ok: false, message: `HTTP ${r.status} — ${r.body.slice(0, 160)}` });
      }
    }
    return { results, error: null };
  });

export const testCourierConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ courier: z.enum(["steadfast"]), config: z.record(z.string(), z.string()) }))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.userId);
    try {
      const r = await callSteadfast("get_balance", data.config);
      return { success: r.ok, status: r.status, message: r.ok ? "Steadfast এর সাথে কানেকশন সফল" : `ব্যর্থ (HTTP ${r.status}) — ${r.body}`, detail: r.body };
    } catch (e) {
      return { success: false, status: 0, message: e instanceof Error ? e.message : "Network error", detail: "" };
    }
  });

export const fetchSteadfastBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ account: AccountSchema }).optional())
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const cfg = await loadSteadfastCfg((data?.account ?? 1) as 1 | 2);
    if (!cfg.api_key || !cfg.secret_key) return { ok: false, balance: null as number | null, message: "Steadfast সেভ করা নেই" };
    try {
      const r = await callSteadfast("get_balance", cfg);
      if (!r.ok) return { ok: false, balance: null, message: `ব্যর্থ (HTTP ${r.status}) — ${r.body}` };
      const j = (r.json as Record<string, unknown>) || {};
      const bal = typeof j.current_balance === "number" ? j.current_balance : typeof j.balance === "number" ? j.balance : Number(j.current_balance ?? j.balance ?? NaN);
      return { ok: true, balance: Number.isFinite(bal) ? bal : null, message: "OK" };
    } catch (e) { return { ok: false, balance: null, message: e instanceof Error ? e.message : "Network error" }; }
  });

function mapSteadfastStatus(s: string): "delivered" | "partial" | "cancelled" | "hold" | "shipped" | "returned" {
  const v = (s || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (v === "delivered") return "delivered";
  if (v === "partial" || v.startsWith("partial_")) return "partial";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "hold") return "hold";
  if (v === "returned" || v === "return" || v === "rto" || v.startsWith("return_") || v.startsWith("rto_")) return "returned";
  if (v === "in_review" || v === "pending" || v === "delivery_pending" || v === "pending_delivery" || v.endsWith("_approval_pending")) return "shipped";
  return "shipped";
}

export const syncSteadfastStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageOrders(context.userId);
    const cfgs: Record<string, string>[] = [];
    for (const acc of [1, 2] as const) {
      const c = await loadSteadfastCfg(acc);
      if (c.api_key && c.secret_key) cfgs.push(c);
    }
    if (!cfgs.length) return { updated: 0, error: "Steadfast not configured" };
    const { data: orders } = await supabaseAdmin.from("orders").select("id,courier_consignment,status").eq("status", "shipped").not("courier_consignment", "is", null).limit(100);
    let updated = 0;
    for (const o of orders ?? []) {
      if (!o.courier_consignment) continue;
      let delivery = "";
      for (const cfg of cfgs) {
        try {
          const r = await callSteadfast(`status_by_cid/${encodeURIComponent(o.courier_consignment)}`, cfg);
          const j = (r.json as Record<string, unknown>) || {};
          const d = String((j.delivery_status as string) || "");
          if (d) { delivery = d; break; }
        } catch { /* try next account */ }
      }
      if (!delivery) continue;
      const mapped = mapSteadfastStatus(delivery);
      if (mapped !== o.status) {
        await supabaseAdmin.from("orders").update({ status: mapped, courier_status: delivery }).eq("id", o.id);
        updated++;
      } else {
        await supabaseAdmin.from("orders").update({ courier_status: delivery }).eq("id", o.id);
      }
    }
    return { updated, error: null };
  });
