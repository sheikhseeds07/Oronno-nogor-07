import { logger } from "@/lib/logger";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { sendPurchaseEvent } from "@/lib/facebook-capi.server";
import { BLOCKED_ORDER_CODE, BLOCKED_ORDER_MESSAGE } from "@/lib/order-block";

const PHONE_RE = /^01[3-9][0-9]{8}$/;
const ORDER_DEVICE_COOKIE = "hng-device-id";

function getOrderDeviceId(): string | null {
  const value = getCookie(ORDER_DEVICE_COOKIE)?.trim() ?? "";
  if (value.length >= 6 && value.length <= 80) return value;
  const id = crypto.randomUUID();
  setCookie(ORDER_DEVICE_COOKIE, id, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return id;
}
const ItemSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(500), price: z.number().min(0).max(10_000_000), quantity: z.number().int().min(1).max(1000) });
const InputSchema = z.object({ customer_name: z.string().min(1).max(255), customer_phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number. Use 01XXXXXXXXX."), customer_address: z.string().min(1).max(1000), district: z.string().max(100).optional().nullable(), thana: z.string().max(100).optional().nullable(), notes: z.string().max(2000).optional().nullable(), delivery_fee: z.number().min(0).max(10000).default(50), items: z.array(ItemSchema).min(1).max(100), created_by: z.string().uuid().optional().nullable(), fbp: z.string().max(200).optional().nullable(), fbc: z.string().max(500).optional().nullable(), source_url: z.string().max(2000).optional().nullable(), checkout_session_id: z.string().max(200).optional().nullable() });
type Input = z.infer<typeof InputSchema>;
const LandingOrderInputSchema = InputSchema.extend({ landing_slug: z.string().min(1).max(200) });

type LandingAddon = { product_id?: string | null; name?: string; price?: number; delivery_fee?: number | null };

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
  emit_purchase: z.boolean().default(true),
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
  logger.error("[saveIncompleteCheckout] snapshot failed:", error.message);
  return null;
});


export const createLandingCheckoutIntent = createServerFn({ method: "POST" }).inputValidator((input) => LandingIntentInputSchema.parse(input)).handler(async ({ data }) => {
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const deviceId = getOrderDeviceId();
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
    p_device_id: deviceId,
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

  if (data.emit_purchase !== false) try {
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
    logger.error("[finalizeLandingCheckoutIntent] CAPI dispatch failed:", e);
  }

  return { id: orderId };
});

export const placeOrder = createServerFn({ method: "POST" }).inputValidator((input: Input) => InputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const deviceId = getOrderDeviceId();

  // Landing pages own their delivery charge. Resolve it server-side from the
  // landing configuration so a generic checkout fallback (e.g. ৳50) can never
  // overwrite an explicitly configured free-delivery offer.
  let effectiveDeliveryFee = data.delivery_fee;
  let landingOwnsDeliveryFee = false;
  try {
    const source = data.source_url ? new URL(data.source_url) : null;
    const match = source?.pathname.match(/^\/landing\/([^/]+)\/?$/);
    if (match) {
      const slug = decodeURIComponent(match[1]);
      const { data: landing } = await supabaseAdmin
        .from("landing_pages")
        .select("main_delivery_fee,delivery_inside,addons")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (landing) {
        const addons = Array.isArray(landing.addons) ? landing.addons as LandingAddon[] : [];
        const requested = data.items[0];
        const addon = requested
          ? addons.find((item) => item.product_id === requested.id || item.name === requested.name)
          : undefined;
        effectiveDeliveryFee = addon
          ? Number(addon.delivery_fee ?? landing.main_delivery_fee ?? landing.delivery_inside ?? 70)
          : Number(landing.main_delivery_fee ?? landing.delivery_inside ?? 70);
        landingOwnsDeliveryFee = Number.isFinite(effectiveDeliveryFee) && effectiveDeliveryFee >= 0;
      }
    }
  } catch {
    // Keep the submitted fee if the landing configuration cannot be resolved.
  }

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
    p_delivery_fee: effectiveDeliveryFee,
    p_items: data.items,
    p_notes: data.notes ?? null,
    p_client_ip: clientIp,
    p_device_id: deviceId,
  } as never);

  if (orderError) {
    const rpcMessage = orderError.message ?? "";
    if (/blocked/i.test(rpcMessage)) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);
    throw new Error(rpcMessage || "Order create failed");
  }
  if (!orderId || typeof orderId !== "string") throw new Error("Order create failed");

  // place_public_order recomputes delivery from the site-wide rules (e.g. ৳50
  // for ৳300+). Landing pages own their delivery charge, so restore it here.
  if (landingOwnsDeliveryFee) {
    const { data: saved } = await supabaseAdmin.from("orders").select("subtotal,delivery_fee").eq("id", orderId).maybeSingle();
    if (saved && Number(saved.delivery_fee) !== effectiveDeliveryFee) {
      await supabaseAdmin.from("orders").update({ delivery_fee: effectiveDeliveryFee, total: Number(saved.subtotal ?? 0) + effectiveDeliveryFee }).eq("id", orderId);
    }
  }

  const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + effectiveDeliveryFee;
  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({ orderId, value: total, currency: "BDT", phone: customerPhone, name: data.customer_name, city: data.district ?? data.thana ?? null, country: "bd", contents: data.items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })), clientIp, userAgent, fbp: data.fbp ?? null, fbc: data.fbc ?? null, eventSourceUrl: data.source_url ?? null } as never);
  } catch (e) { logger.error("[placeOrder] CAPI dispatch failed:", e); }

  return { id: orderId };
});

export const placeLandingOrder = createServerFn({ method: "POST" }).inputValidator((input) => LandingOrderInputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const deviceId = getOrderDeviceId();
  const { data: blocked, error: blockCheckError } = await supabaseAdmin.rpc("is_blocked_visitor", { p_ip: clientIp ?? undefined, p_phone: customerPhone });
  if (!blockCheckError && blocked === true) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);

  const { data: page, error: pageError } = await supabaseAdmin
    .from("landing_pages")
    .select("product_id,sale_price,regular_price,main_delivery_fee,addons,products(name,price,sale_price)")
    .eq("slug", data.landing_slug)
    .eq("is_published", true)
    .maybeSingle();
  if (pageError || !page) throw new Error("ল্যান্ডিং পেজের অফারটি পাওয়া যায়নি");

  const product = Array.isArray(page.products) ? page.products[0] : page.products;
  const mainPrice = Number(page.sale_price ?? product?.sale_price ?? page.regular_price ?? product?.price ?? 0);
  const offers = [
    ...(page.product_id && product ? [{ id: page.product_id, name: product.name, price: mainPrice, deliveryFee: Number(page.main_delivery_fee ?? 70) }] : []),
    ...((Array.isArray(page.addons) ? page.addons : []) as LandingAddon[]).map((addon, index) => ({
      id: addon.product_id || `addon-${index}`,
      name: String(addon.name ?? ""),
      price: Number(addon.price ?? 0),
      deliveryFee: addon.delivery_fee == null ? Number(page.main_delivery_fee ?? 70) : Number(addon.delivery_fee),
    })),
  ];
  const requested = data.items[0];
  const offer = data.items.length === 1 && requested
    ? offers.find((candidate) => candidate.id === requested.id || (!page.product_id && candidate.name === requested.name))
    : undefined;
  if (!requested || !offer || offer.price < 0 || offer.deliveryFee < 0) throw new Error("ল্যান্ডিং পেজের প্যাকেজটি সঠিক নয়");

  const items = [{ id: offer.id, name: offer.name, price: offer.price, quantity: requested.quantity }];
  const { data: intentId, error: intentError } = await supabaseAdmin.rpc("create_landing_checkout_intent" as never, {
    p_checkout_session_id: crypto.randomUUID(),
    p_customer_name: data.customer_name.trim(),
    p_customer_phone: customerPhone,
    p_customer_address: data.customer_address.trim(),
    p_delivery_fee: offer.deliveryFee,
    p_seed_items: items,
    p_nutrimix_item: null,
    p_notes: data.notes ?? null,
    p_client_ip: clientIp,
    p_device_id: deviceId,
  } as never);
  if (intentError || !intentId || typeof intentId !== "string") {
    const rpcMessage = intentError?.message ?? "";
    if (/blocked/i.test(rpcMessage)) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);
    throw new Error(rpcMessage || "Checkout intent create failed");
  }

  const { data: orderId, error: orderError } = await supabaseAdmin.rpc("finalize_landing_checkout_intent" as never, {
    p_intent_id: intentId,
    p_include_nutrimix: false,
  } as never);
  if (orderError) {
    const rpcMessage = orderError.message ?? "";
    if (/blocked/i.test(rpcMessage)) throw new Error(`${BLOCKED_ORDER_CODE}: ${BLOCKED_ORDER_MESSAGE}`);
    throw new Error(rpcMessage || "Order create failed");
  }
  if (!orderId || typeof orderId !== "string") throw new Error("Order create failed");

  const subtotal = offer.price * requested.quantity;
  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({ orderId, value: subtotal + offer.deliveryFee, currency: "BDT", phone: customerPhone, name: data.customer_name, country: "bd", contents: items.map((item) => ({ id: item.id, quantity: item.quantity, price: item.price })), clientIp, userAgent, fbp: data.fbp ?? null, fbc: data.fbc ?? null, eventSourceUrl: data.source_url ?? null } as never);
  } catch (e) { logger.error("[placeLandingOrder] CAPI dispatch failed:", e); }

  return { id: orderId };
});
