import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { supabase } from "@/integrations/supabase/client";
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
// This is auxiliary telemetry; it must never block the real checkout.
export const saveIncompleteCheckout = createServerFn({ method: "POST" }).inputValidator((input) => IncompleteInputSchema.parse(input)).handler(async ({ data }) => {
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const rpcArgs = {
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
  };
  const { data: result, error } = await supabaseAdmin.rpc("upsert_incomplete_checkout", rpcArgs);
  if (!error) return result;

  // Autosave requests can race each other. The DB has a unique active-phone
  // constraint, so recover the row created by the winning concurrent request.
  if (/duplicate key value violates unique constraint.*incomplete_orders_phone_active_uq/i.test(error.message ?? "")) {
    const { data: existing } = await supabaseAdmin.from("incomplete_orders").select("id").eq("phone", data.customer_phone).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return existing?.id ?? null;
  }

  // Never surface auxiliary autosave failures as checkout failures.
  console.error("[saveIncompleteCheckout] snapshot failed:", error.message);
  return null;
});

export const placeOrder = createServerFn({ method: "POST" }).inputValidator((input: Input) => InputSchema.parse(input)).handler(async ({ data }) => {
  const customerPhone = data.customer_phone;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;

  // Checkout must not depend on an admin/service credential. The public RPC is a
  // narrowly-scoped, validated SECURITY DEFINER endpoint that creates only orders.
  const { data: orderId, error: orderError } = await (supabase as any).rpc("place_public_order", {
    p_customer_name: data.customer_name.trim(),
    p_customer_phone: customerPhone,
    p_customer_address: data.customer_address.trim(),
    p_delivery_fee: data.delivery_fee,
    p_items: data.items,
    p_notes: data.notes ?? null,
    p_client_ip: clientIp,
  });

  if (orderError) throw new Error(orderError.message ?? "Order create failed");
  if (!orderId || typeof orderId !== "string") throw new Error("Order create failed");

  const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0) + data.delivery_fee;

  try {
    const userAgent = getRequestHeader("user-agent") ?? null;
    await sendPurchaseEvent({
      orderId,
      value: total,
      currency: "BDT",
      phone: customerPhone,
      name: data.customer_name,
      city: data.district ?? data.thana ?? null,
      country: "bd",
      contents: data.items.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
      clientIp,
      userAgent,
      fbp: data.fbp ?? null,
      fbc: data.fbc ?? null,
      eventSourceUrl: data.source_url ?? null,
    });
  } catch (e) {
    console.error("[placeOrder] CAPI dispatch failed:", e);
  }

  return { id: orderId };
});
