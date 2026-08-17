import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { sendPurchaseEvent } from "@/lib/facebook-capi.server";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const ItemSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(500), price: z.number().min(0).max(10_000_000), quantity: z.number().int().min(1).max(1000) });
const InputSchema = z.object({ customer_name: z.string().min(1).max(255), customer_phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number. Use 01XXXXXXXXX."), customer_address: z.string().min(1).max(1000), district: z.string().max(100).optional().nullable(), thana: z.string().max(100).optional().nullable(), notes: z.string().max(2000).optional().nullable(), delivery_fee: z.number().min(0).max(10000).default(50), items: z.array(ItemSchema).min(1).max(100), created_by: z.string().uuid().optional().nullable(), fbp: z.string().max(200).optional().nullable(), fbc: z.string().max(500).optional().nullable(), source_url: z.string().max(2000).optional().nullable() });
const IncompleteInputSchema = z.object({ customer_name: z.string().max(255).optional().nullable(), customer_phone: z.string().regex(PHONE_RE), customer_address: z.string().max(1000).optional().nullable(), delivery_zone: z.string().max(100).optional().nullable(), delivery_fee: z.number().min(0).max(10000), subtotal: z.number().min(0).max(10_000_000), total: z.number().min(0).max(10_000_000), note: z.string().max(2000).optional().nullable(), items: z.array(ItemSchema).min(1).max(100) });

export const lookupCustomerByPhone = createServerFn({ method: "POST" }).inputValidator((input) => z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") }).parse(input)).handler(async ({ data }) => {
  const { data: order } = await supabaseAdmin.from("orders").select("customer_name,customer_address").eq("customer_phone", data.phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return order ? { name: order.customer_name, address: order.customer_address } : null;
});

// Save the checkout snapshot as soon as the customer has entered a full 11-digit phone.
// The DB RPC keeps one latest record per phone/IP. A successful placeOrder removes it.
export const saveIncompleteCheckout = createServerFn({ method: "POST" }).inputValidator((input) => IncompleteInputSchema.parse(input)).handler(async ({ data }) => {
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const { data: result, error } = await supabaseAdmin.rpc("upsert_incomplete_checkout", {
    p_phone: data.customer_phone,
    p_ip: clientIp,
    p_customer_name: data.customer_name ?? null,
    p_customer_address: data.customer_address ?? null,
    p_delivery_zone: data.delivery_zone ?? null,
    p_delivery_fee: data.delivery_fee,
    p_subtotal: data.subtotal,
    p_total: data.total,
    p_note: data.note ?? null,
    p_items: data.items,
  });
  if (error) throw new Error(error.message);
  return result;
});

export const placeOrder = createServerFn({ method: "POST" }).inputValidator((input) => InputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const { data: siteSettings, error: settingsError } = await supabaseAdmin.from("site_settings").select("settings").maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  const settings = (siteSettings?.settings ?? {}) as Record<string, unknown>;
  const phoneRepeatMinutes = Math.max(0, Math.min(10080, Number(settings.order_repeat_phone_minutes ?? settings.order_phone_repeat_minutes ?? 0)));
  const ipRepeatMinutes = Math.max(0, Math.min(10080, Number(settings.order_repeat_ip_minutes ?? settings.order_ip_repeat_minutes ?? 0)));
  if (phoneRepeatMinutes > 0 || ipRepeatMinutes > 0) {
    const { data: rate, error: rateError } = await supabaseAdmin.rpc("check_and_touch_order_rate_limit", { p_phone: customerPhone, p_ip: clientIp, p_phone_minutes: phoneRepeatMinutes, p_ip_minutes: ipRepeatMinutes });
    if (rateError) throw new Error(`আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে। পরবর্তী অর্ডার করতে আরও ${Math.max(1, Math.max(phoneRepeatMinutes, ipRepeatMinutes))} মিনিট অপেক্ষা করুন।`);
    if (rate && rate.allowed === false) throw new Error(`আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে। পরবর্তী অর্ডার করতে আরও ${Math.max(1, Number(rate.wait_minutes ?? Math.max(phoneRepeatMinutes, ipRepeatMinutes)))} মিনিট অপেক্ষা করুন।`);
  }
  const { data: matchedIncomplete } = await supabaseAdmin.from("incomplete_orders").select("id,phone").or(`phone.eq.${customerPhone}${clientIp ? `,ip.eq.${clientIp}` : ""}`).limit(20);
  if (matchedIncomplete?.length) {
    await supabaseAdmin.from("incomplete_events").insert(matchedIncomplete.map((r) => ({ phone: r.phone, event: "converted" })));
    await supabaseAdmin.from("incomplete_orders").delete().in("id", matchedIncomplete.map((r) => r.id));
  }
  const uuidIds = data.items.map((i) => i.id).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
  const { data: dbProducts } = uuidIds.length ? await supabaseAdmin.from("products").select("id,price,sale_price").in("id", uuidIds) : { data: [] as { id: string; price: number; sale_price: number | null }[] };
  const priceMap = new Map<string, number>();
  for (const p of dbProducts ?? []) priceMap.set(p.id, p.sale_price != null && p.sale_price > 0 ? Number(p.sale_price) : Number(p.price));
  const safeItems = data.items.map((i) => { const dbPrice = priceMap.get(i.id); return dbPrice != null ? { ...i, price: dbPrice } : i; });
  const subtotal = safeItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal + data.delivery_fee;
  const orderRes = await supabaseAdmin.from("orders").insert({ customer_name: data.customer_name, customer_phone: customerPhone, customer_address: data.customer_address, district: data.district ?? null, thana: data.thana ?? null, notes: data.notes ?? null, subtotal, delivery_fee: data.delivery_fee, total, payment_method: "COD", source: "web", status: "web_pending", created_by: null, originated_from_incomplete: false }).select("id").single();
  if (orderRes.error || !orderRes.data) throw new Error(orderRes.error?.message ?? "Order create failed");
  const order = orderRes.data;
  const validIds = new Set((dbProducts ?? []).map((r) => r.id));
  const rows = safeItems.map((i) => ({ order_id: order.id, product_id: validIds.has(i.id) ? i.id : null, product_name: i.name, price: i.price, quantity: i.quantity, subtotal: i.price * i.quantity }));
  const itemsRes = await supabaseAdmin.from("order_items").insert(rows);
  if (itemsRes.error) { await supabaseAdmin.from("orders").delete().eq("id", order.id); throw new Error(itemsRes.error.message); }
  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({ orderId: order.id, value: total, currency: "BDT", phone: customerPhone, name: data.customer_name, city: data.district ?? data.thana ?? null, country: "bd", contents: safeItems.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })), clientIp, userAgent, fbp: data.fbp ?? null, fbc: data.fbc ?? null, eventSourceUrl: data.source_url ?? null });
  } catch (e) { console.error("[placeOrder] CAPI dispatch failed:", e); }
  return { id: order.id };
});
