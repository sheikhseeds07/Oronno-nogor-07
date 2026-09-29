import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { sendPurchaseEvent } from "@/lib/facebook-capi.server";
import { BLOCKED_ORDER_CODE, BLOCKED_ORDER_MESSAGE } from "@/lib/order-block";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const ItemSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(500), price: z.number().min(0).max(10_000_000), quantity: z.number().int().min(1).max(1000) });
const InputSchema = z.object({ customer_name: z.string().min(1).max(255), customer_phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number. Use 01XXXXXXXXX."), customer_address: z.string().min(1).max(1000), district: z.string().max(100).optional().nullable(), thana: z.string().max(100).optional().nullable(), notes: z.string().max(2000).optional().nullable(), delivery_fee: z.number().min(0).max(10000).default(50), items: z.array(ItemSchema).min(1).max(100), created_by: z.string().uuid().optional().nullable(), fbp: z.string().max(200).optional().nullable(), fbc: z.string().max(500).optional().nullable(), source_url: z.string().max(2000).optional().nullable(), checkout_session_id: z.string().max(200).optional().nullable() });
type Input = z.infer<typeof InputSchema>;

const LandingIntentInputSchema = z.object({
  checkout_session_id: z.string().uuid(),
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().regex(PHONE_RE),
  customer_address: z.string().min(1).max(1000),
  delivery_fee: z.number().min(0).max(10000),
  seed_items: z.array(ItemSchema).min(1).max(100),
  nutrimix_item: ItemSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
const LandingFinalizeInputSchema = z.object({
  intent_id: z.string().uuid(),
  include_nutrimix: z.boolean().default(false),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(500).optional().nullable(),
  source_url: z.string().max(2000).optional().nullable(),
});

const IncompleteInputSchema = z.object({ customer_name: z.string().max(255).optional().nullable(), customer_phone: z.string().regex(PHONE_RE), customer_address: z.string().max(1000).optional().nullable(), delivery_zone: z.string().max(100).optional().nullable(), delivery_fee: z.number().min(0).max(10000), subtotal: z.number().min(0).max(10_000_000), total: z.number().min(0).max(10_000_000), note: z.string().max(2000).optional().nullable(), items: z.array(ItemSchema).min(1).max(100) });


export const lookupCustomerByPhone = createServerFn({ method: "POST" }).inputValidator((input) => z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") }).parse(input)).handler(async ({ data }) => {
  const { data: order } = await supabaseAdmin.from("orders").select("customer_name,customer_address").eq("customer_phone", data.phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return order ? { name: order.customer_name, address: order.customer_address } : null;
});

export const saveIncompleteCheckout = createServerFn({ method: "POST" }).inputValidator((input) => IncompleteInputSchema.parse(input)).handler(async ({ data }) => {
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const rpcArgs = { p_phone: data.customer_phone, p_ip: clientIp, p_customer_name: data.customer_name ?? null, p_customer_address: data.customer_address ?? null, p_delivery_zone: data.delivery_zone ?? null, p_delivery_fee: data.delivery_fee, p_subtotal: data.subtotal, p_total: data.total, p_note: data.note ?? null, p_items: data.items };
  const { data: result, error } = await supabaseAdmin.rpc("upsert_incomplete_checkout", rpcArgs as never);
  if (!error) return result;
  if (/duplicate key value violates unique constraint.*incomplete_orders_phone_active_uq/i.test(error.message ?? "")) {
    const { data: existing } = await supabaseAdmin.from("incomplete_orders").select("id").eq("phone", data.customer_phone).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return existing?.id ?? null;
  }
  console.error("[saveIncompleteCheckout] snapshot failed:", error.message);
  return null;
});


export const createLandingCheckoutIntent = createServerFn({ method: "POST" }).inputValidator((input) => LandingIntentInputSchema.parse(input)).handler(async ({ data }) => {
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const { data: intentId, error } = await supabaseAdmin.rpc("create_landing_checkout_intent", {
    p_checkout_session_id: data.checkout_session_id,
    p_customer_name: data.customer_name,
    p_customer_phone: data.customer_phone,
    p_customer_address: data.customer_address,
    p_delivery_fee: data.delivery_fee,
    p_seed_items: data.seed_items,
    p_nutrimix_item: data.nutrimix_item ?? null,
    p_notes: data.notes ?? null,
    p_client_ip: clientIp,
  } as never);
  if (error) {
    if (/blocked/i.test(error.message ?? "")) throw new Error(BLOCKED_ORDER_MESSAGE);
    throw new Error(error.message || "Checkout intent create failed");
  }
  if (!intentId || typeof intentId !== "string") throw new Error("Checkout intent create failed");
  return { id: intentId };
});

export const finalizeLandingCheckoutIntent = createServerFn({ method: "POST" }).inputValidator((input) => LandingFinalizeInputSchema.parse(input)).handler(async ({ data }) => {
  const { data: orderId, error } = await supabaseAdmin.rpc("finalize_landing_checkout_intent", {
    p_intent_id: data.intent_id,
    p_include_nutrimix: data.include_nutrimix,
  } as never);
  if (error) {
    if (/blocked/i.test(error.message ?? "")) throw new Error(BLOCKED_ORDER_MESSAGE);
    throw new Error(error.message || "Order create failed");
  }
  if (!orderId || typeof orderId !== "string") throw new Error("Order create failed");

  try {
    const [{ data: order }, { data: rows }] = await Promise.all([
      supabaseAdmin.from("orders").select("customer_phone,customer_name,total,client_ip").eq("id", orderId).maybeSingle(),
      supabaseAdmin.from("order_items").select("product_id,quantity,price").eq("order_id", orderId),
    ]);
    if (order) {
      const userAgent = getRequestHeader("user-agent") ?? null;
      await sendPurchaseEvent({
        orderId,
        value: Number(order.total) || 0,
        currency: "BDT",
        phone: order.customer_phone,
        name: order.customer_name,
        country: "bd",
        contents: (rows ?? []).map((i) => ({ id: i.product_id ?? "landing-popup-nutrimix", quantity: i.quantity, price: Number(i.price) || 0 })),
        clientIp: order.client_ip ?? null,
        userAgent,
        fbp: data.fbp ?? null,
        fbc: data.fbc ?? null,
        eventSourceUrl: data.source_url ?? null,
      } as never);
    }
  } catch (e) {
    console.error("[finalizeLandingCheckoutIntent] CAPI dispatch failed:", e);
  }

  return { id: orderId };
});

export const placeOrder = createServerFn({ method: "POST" }).inputValidator((input: Input) => InputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;

  // Checkout runs through the server, so use the server/admin client for both
  // RPCs. This avoids the browser client's RLS/session state from turning a
  // valid checkout submission into a failed server action/navigation.
  // Mobile carriers frequently share one public IP between many unrelated
  // customers. Blocking checkout by phone keeps the fraud block precise and
  // prevents one customer's IP from locking out innocent visitors.
  const { data: blocked, error: blockCheckError } = await supabaseAdmin.rpc("is_blocked_visitor", { p_ip: clientIp ?? undefined, p_phone: customerPhone });
  if (!blockCheckError && blocked === true) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);

  const { data: orderId, error: orderError } = await supabaseAdmin.rpc("place_public_order", {
    p_customer_name: data.customer_name.trim(),
    p_customer_phone: customerPhone,
    p_customer_address: data.customer_address.trim(),
    p_delivery_fee: data.delivery_fee,
    p_items: data.items,
    p_notes: data.notes ?? null,
    p_client_ip: clientIp,
  } as never);

  if (orderError) {
    const rpcMessage = orderError.message ?? "";
    if (/blocked/i.test(rpcMessage)) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);
    throw new Error(rpcMessage || "Order create failed");
  }
  if (!orderId || typeof orderId !== "string") throw new Error("Order create failed");

  const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + data.delivery_fee;
  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({ orderId, value: total, currency: "BDT", phone: customerPhone, name: data.customer_name, city: data.district ?? data.thana ?? null, country: "bd", contents: data.items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })), clientIp, userAgent, fbp: data.fbp ?? null, fbc: data.fbc ?? null, eventSourceUrl: data.source_url ?? null } as never);
  } catch (e) { console.error("[placeOrder] CAPI dispatch failed:", e); }

  return { id: orderId };
});
