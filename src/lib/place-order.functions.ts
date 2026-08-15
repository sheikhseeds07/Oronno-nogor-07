import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { sendPurchaseEvent } from "@/lib/facebook-capi.server";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const ItemSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(500), price: z.number().min(0).max(10_000_000), quantity: z.number().int().min(1).max(1000) });
const InputSchema = z.object({
  customer_name: z.string().min(1).max(255), customer_phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number. Use 01XXXXXXXXX."), customer_address: z.string().min(1).max(1000), district: z.string().max(100).optional().nullable(), thana: z.string().max(100).optional().nullable(), notes: z.string().max(2000).optional().nullable(), delivery_fee: z.number().min(0).max(10000).default(50), items: z.array(ItemSchema).min(1).max(100), created_by: z.string().uuid().optional().nullable(), checkout_session_id: z.string().uuid().optional().nullable(), fbp: z.string().max(200).optional().nullable(), fbc: z.string().max(500).optional().nullable(), source_url: z.string().max(2000).optional().nullable(),
});

export const placeOrder = createServerFn({ method: "POST" }).inputValidator((input) => InputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;

  const { data: siteSettings, error: settingsError } = await supabaseAdmin.from("site_settings").select("settings").maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  const settings = (siteSettings?.settings ?? {}) as Record<string, unknown>;
  // Keep these keys identical to the Admin Settings UI. Also accept the older
  // names so existing installations do not silently lose their configured limit.
  const phoneRepeatMinutes = Math.max(0, Math.min(10080, Number(settings.order_repeat_phone_minutes ?? settings.order_phone_repeat_minutes ?? 0)));
  const ipRepeatMinutes = Math.max(0, Math.min(10080, Number(settings.order_repeat_ip_minutes ?? settings.order_ip_repeat_minutes ?? 0)));
  if (phoneRepeatMinutes > 0 || ipRepeatMinutes > 0) {
    const { data: rate, error: rateError } = await supabaseAdmin.rpc("check_and_touch_order_rate_limit", { p_phone: customerPhone, p_ip: clientIp, p_phone_minutes: phoneRepeatMinutes, p_ip_minutes: ipRepeatMinutes });
    if (rateError) {
      console.error("[placeOrder] order repeat limit check failed:", rateError);
      throw new Error("অর্ডার সিকিউরিটি যাচাই করা যায়নি। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
    if (rate && rate.allowed === false) {
      const wait = Number(rate.wait_minutes ?? 1);
      throw new Error(`আপনার কাছ থেকে একটি অর্ডার ইতোমধ্যে নেওয়া হয়েছে। অনুগ্রহ করে ${wait} মিনিট পরে আবার চেষ্টা করুন।`);
    }
  }

  const uuidIds = data.items.map((i) => i.id).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  const { data: dbProducts } = uuidIds.length ? await supabaseAdmin.from("products").select("id,price,sale_price").in("id", uuidIds) : { data: [] as { id: string; price: number; sale_price: number | null }[] };
  const priceMap = new Map<string, number>();
  for (const p of dbProducts ?? []) priceMap.set(p.id, p.sale_price != null && p.sale_price > 0 ? Number(p.sale_price) : Number(p.price));
  const safeItems = data.items.map((i) => { const dbPrice = priceMap.get(i.id); return dbPrice != null ? { ...i, price: dbPrice } : i; });
  const subtotal = safeItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal + data.delivery_fee;

  const orderRes = await supabaseAdmin.from("orders").insert({ customer_name: data.customer_name, customer_phone: customerPhone, customer_address: data.customer_address, district: data.district ?? null, thana: data.thana ?? null, notes: data.notes ?? null, subtotal, delivery_fee: data.delivery_fee, total, payment_method: "COD", source: "web", status: "web_pending", created_by: data.created_by ?? null }).select("id").single();
  if (orderRes.error || !orderRes.data) throw new Error(orderRes.error?.message ?? "Order create failed");
  const order = orderRes.data;
  const validIds = new Set((dbProducts ?? []).map((r) => r.id));
  const rows = safeItems.map((i) => ({ order_id: order.id, product_id: validIds.has(i.id) ? i.id : null, product_name: i.name, price: i.price, quantity: i.quantity, subtotal: i.price * i.quantity }));
  const itemsRes = await supabaseAdmin.from("order_items").insert(rows);
  if (itemsRes.error) { await supabaseAdmin.from("orders").delete().eq("id", order.id); throw new Error(itemsRes.error.message); }

  let converted = false;
  try {
    if (data.checkout_session_id) {
      const { data: deleted, error } = await supabaseAdmin.from("incomplete_orders").delete().eq("checkout_session_id", data.checkout_session_id).select("id");
      if (error) throw error; converted = (deleted ?? []).length > 0;
    } else {
      const { data: latest, error: findError } = await supabaseAdmin.from("incomplete_orders").select("id").eq("phone", customerPhone).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (findError) throw findError;
      if (latest) { const { error: deleteError } = await supabaseAdmin.from("incomplete_orders").delete().eq("id", latest.id); if (deleteError) throw deleteError; converted = true; }
    }
  } catch (e) { console.error("[placeOrder] incomplete draft cleanup failed:", e); }
  if (converted) await supabaseAdmin.from("incomplete_events").insert({ phone: customerPhone, event: "converted" });

  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({ orderId: order.id, value: total, currency: "BDT", phone: customerPhone, name: data.customer_name, city: data.district ?? data.thana ?? null, country: "bd", contents: safeItems.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })), clientIp, userAgent, fbp: data.fbp ?? null, fbc: data.fbc ?? null, eventSourceUrl: data.source_url ?? null });
  } catch (e) { console.error("[placeOrder] CAPI dispatch failed:", e); }
  return { id: order.id };
});
