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
    headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json", "Accept": "application/json" },
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

    const { data: siteSettingsRow } = await supabaseAdmin.from("site_settings").select("settings").maybeSingle();
    const siteSettings = (siteSettingsRow?.settings ?? {}) as Record<string, unknown>;
    const deliveryNote = typeof siteSettings.delivery_note === "string" ? siteSettings.delivery_note : "";

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
        results.push({ id: o.id, ok: false, already: true, consignment: o.courier_consignment, message: "ইতিমধ্যে কুরিয়ারে এন্ট্রি আছে; অন্য অ্যাকাউন্টে পাঠানো যাবে না" });
        continue;
      }

      // One database row per order is the global lock shared by both accounts,
      // all employees/admins, and every concurrent bulk request.
      const { error: claimError } = await supabaseAdmin.from("courier_upload_guard").insert({
        order_id: o.id,
        provider: "steadfast",
        account,
        state: "processing",
        created_by: context.userId,
      });
      if (claimError) {
        if (claimError.code === "23505") {
          const { data: prior } = await supabaseAdmin.from("courier_upload_guard")
            .select("state,account,consignment")
            .eq("order_id", o.id)
            .maybeSingle();
          results.push({
            id: o.id,
            ok: false,
            already: true,
            consignment: prior?.consignment || undefined,
            message: prior?.state === "success"
              ? "এই অর্ডারটি ইতিমধ্যে কুরিয়ারে পাঠানো হয়েছে; পুনরায় আপলোড বন্ধ"
              : "এই অর্ডারের কুরিয়ার আপলোড চলছে বা যাচাই অপেক্ষমাণ; ডুপ্লিকেট এড়াতে পুনরায় পাঠানো বন্ধ",
          });
        } else {
          results.push({ id: o.id, ok: false, message: "ডাটাবেজে আপলোড লক নেওয়া যায়নি; নিরাপত্তার জন্য পাঠানো হয়নি" });
        }
        continue;
      }

      const setGuard = async (state: "success" | "unknown" | "rejected", values: { invoice_no?: string; consignment?: string; last_error?: string } = {}) => {
        await supabaseAdmin.from("courier_upload_guard").update({
          state,
          ...values,
          resolved_at: state === "processing" ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("order_id", o.id);
      };

      let invoice: string;
      try {
        invoice = await ensureOrderInvoiceNo(o.id, o.invoice_no);
        await supabaseAdmin.from("courier_upload_guard").update({ invoice_no: invoice, updated_at: new Date().toISOString() }).eq("order_id", o.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Invoice generation failed";
        await setGuard("unknown", { last_error: message.slice(0, 500) });
        results.push({ id: o.id, ok: false, message: "ইনভয়েস প্রস্তুত করা যায়নি; নিরাপত্তার জন্য আপলোড লক রাখা হয়েছে" });
        continue;
      }

      // Never create a parcel unless the provider explicitly confirms that
      // this invoice is absent. A timeout/5xx/unknown response is ambiguous.
      let chk: Awaited<ReturnType<typeof callSteadfast>>;
      try {
        chk = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Invoice lookup network error";
        await setGuard("unknown", { invoice_no: invoice, last_error: message.slice(0, 500) });
        results.push({ id: o.id, ok: false, message: "কুরিয়ারে আগের এন্ট্রি যাচাই করা যায়নি; ডুপ্লিকেট এড়াতে আপলোড বন্ধ রাখা হয়েছে" });
        continue;
      }

      const existing = deepFind(chk.json, ["consignment_id", "tracking_code"]);
      const dstatus = deepFind(chk.json, ["delivery_status", "status_text"]);
      const known = Boolean(dstatus && !/not[_\\s-]?found|invalid|unknown/i.test(dstatus));
      if (chk.ok && (existing || known)) {
        const savedConsignment = existing || invoice;
        const { error: saveError } = await supabaseAdmin.from("orders").update({
          courier_consignment: savedConsignment,
          courier_status: dstatus || "in_review",
          courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`,
        }).eq("id", o.id);
        await setGuard("success", { invoice_no: invoice, consignment: savedConsignment, last_error: saveError?.message });
        results.push({
          id: o.id,
          ok: false,
          already: true,
          consignment: savedConsignment,
          message: saveError
            ? "কুরিয়ারে আগের এন্ট্রি পাওয়া গেছে; সাইটে সেভে সমস্যা হয়েছে। পুনরায় আপলোড করবেন না।"
            : "আগেই কুরিয়ারে এন্ট্রি পাওয়া গেছে; নতুন করে পাঠানো হয়নি",
        });
        continue;
      }

      const explicitlyNotFound = /not[_\\s-]?found|no data|no record|invalid invoice/i.test(chk.body)
        && (chk.ok || chk.status === 404);
      if (!explicitlyNotFound) {
        await setGuard("unknown", { invoice_no: invoice, last_error: `Invoice lookup inconclusive: HTTP ${chk.status} ${chk.body}`.slice(0, 500) });
        results.push({ id: o.id, ok: false, message: "কুরিয়ারের আগের এন্ট্রি নিশ্চিতভাবে যাচাই করা যায়নি; নিরাপত্তার জন্য নতুন আপলোড বন্ধ রাখা হয়েছে" });
        continue;
      }

      const basePayload = {
        invoice,
        recipient_name: (o.customer_name || "").slice(0, 100),
        recipient_phone: (o.customer_phone || "").replace(/\\D/g, "").slice(-11),
        recipient_address: [o.customer_address, o.thana, o.district].filter(Boolean).join(", ").slice(0, 240),
        cod_amount: Number(o.total) || 0,
      };
      const itemDescription = buildNote(o.id);
      const createPayload = { ...basePayload, item_description: itemDescription, note: deliveryNote.slice(0, 110) };

      let r: Awaited<ReturnType<typeof callSteadfast>>;
      try {
        r = await callSteadfast("create_order", cfg, createPayload);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Steadfast network error";
        await setGuard("unknown", { invoice_no: invoice, last_error: message.slice(0, 500) });
        results.push({ id: o.id, ok: false, message: "কুরিয়ারে পাঠানোর রেসপন্স পাওয়া যায়নি; অর্ডারটি যাচাই না হওয়া পর্যন্ত পুনরায় আপলোড বন্ধ থাকবে" });
        continue;
      }

      let consignment = deepFind(r.json, ["consignment_id", "tracking_code"]);
      if (!consignment) {
        try {
          const postCheck = await callSteadfast(`status_by_invoice/${encodeURIComponent(invoice)}`, cfg);
          consignment = deepFind(postCheck.json, ["consignment_id", "tracking_code"]);
        } catch { /* request may have succeeded despite a lost response */ }
      }

      if (!consignment) {
        await setGuard("unknown", {
          invoice_no: invoice,
          last_error: `Create response HTTP ${r.status}: ${r.body}`.slice(0, 500),
        });
        const htmlResponse = /<!doctype html|<html/i.test(r.body);
        const message = r.status >= 500 && htmlResponse
          ? `কুরিয়ার সার্ভার HTTP ${r.status} দিয়েছে। ইনভয়েস ${invoice} দিয়ে এন্ট্রি নিশ্চিত হয়নি; ডুপ্লিকেট এড়াতে পুনরায় পাঠানো বন্ধ রাখা হয়েছে।`
          : `কুরিয়ার রেসপন্স HTTP ${r.status}; এন্ট্রি নিশ্চিত হয়নি। যাচাই ছাড়া পুনরায় আপলোড করবেন না।`;
        results.push({ id: o.id, ok: false, message });
        continue;
      }

      const { error: saveError } = await supabaseAdmin.from("orders").update({
        courier_consignment: consignment,
        courier_status: "in_review",
        courier_display_name: (cfg.display_name || "").trim() || `Courier ${account}`,
      }).eq("id", o.id);
      await setGuard("success", { invoice_no: invoice, consignment, last_error: saveError?.message });
      if (saveError) {
        results.push({ id: o.id, ok: false, consignment, message: "কুরিয়ারে এন্ট্রি হয়েছে, কিন্তু সাইটে ট্র্যাকিং নম্বর সেভ হয়নি। পুনরায় আপলোড করবেন না; অর্ডারটি যাচাই করুন।" });
      } else {
        results.push({ id: o.id, ok: true, consignment, message: "পাঠানো হয়েছে" });
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
      let r = await callSteadfast("get_balance", data.config);
      // Balance is a read-only endpoint, so one bounded retry is safe for transient provider 5xx errors.
      if (r.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        r = await callSteadfast("get_balance", data.config);
      }
      if (r.ok) return { success: true, status: r.status, message: "Steadfast এর সাথে কানেকশন সফল", detail: r.body };
      const htmlError = /<!doctype html|<html/i.test(r.body);
      const message = r.status >= 500 && htmlError
        ? `Steadfast API সার্ভার HTTP ${r.status} দিচ্ছে। একবার পুনরায় পরীক্ষা করেও সার্ভার রেসপন্স ঠিক হয়নি; API সার্ভারের সমস্যা বা অ্যাকাউন্ট-সাইড ত্রুটি যাচাই প্রয়োজন।`
        : `ব্যর্থ (HTTP ${r.status}) — ${r.body}`;
      return { success: false, status: r.status, message, detail: r.body };
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
    const updatedIds: string[] = [];
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
        updatedIds.push(o.id);
      } else {
        await supabaseAdmin.from("orders").update({ courier_status: delivery }).eq("id", o.id);
      }
    }
    return { updated, updatedIds, error: null };
  });
