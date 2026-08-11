import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { sendPurchaseEvent } from "@/lib/facebook-capi.server";

const normPhone = (p: string) => {
  const clean = p.replace(/[\s-]/g, "");
  if (clean.startsWith("+8801")) return `0${clean.slice(4)}`;
  if (clean.startsWith("8801")) return `0${clean.slice(3)}`;
  return clean;
};

const ItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(500),
  price: z.number().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1000),
});

const InputSchema = z.object({
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().min(3).max(32),
  customer_address: z.string().min(1).max(1000),
  district: z.string().max(100).optional().nullable(),
  thana: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  delivery_fee: z.number().min(0).max(10000).default(50),
  items: z.array(ItemSchema).min(1).max(100),
  created_by: z.string().uuid().optional().nullable(),
  // Browser-side context for Facebook Conversions API:
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(500).optional().nullable(),
  source_url: z.string().max(2000).optional().nullable(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const customerPhone = normPhone(data.customer_phone);

    // SECURITY: never trust client-supplied prices. For items whose `id` is a
    // real product UUID, override the price with the lower of (price, sale_price)
    // from the DB. Non-UUID items (custom landing-page add-ons) keep their
    // client price — but admin should review before fulfilment.
    const uuidIds = data.items.map((i) => i.id).filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    const { data: dbProducts } = uuidIds.length
      ? await supabaseAdmin.from("products").select("id,price,sale_price").in("id", uuidIds)
      : { data: [] as { id: string; price: number; sale_price: number | null }[] };
    const priceMap = new Map<string, number>();
    for (const p of dbProducts ?? []) {
      const effective = p.sale_price != null && p.sale_price > 0 ? Number(p.sale_price) : Number(p.price);
      priceMap.set(p.id, effective);
    }
    const safeItems = data.items.map((i) => {
      const dbPrice = priceMap.get(i.id);
      return dbPrice != null ? { ...i, price: dbPrice } : i;
    });

    const subtotal = safeItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + data.delivery_fee;

    const orderRes = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        customer_phone: customerPhone,
        customer_address: data.customer_address,
        district: data.district ?? null,
        thana: data.thana ?? null,
        notes: data.notes ?? null,
        subtotal,
        delivery_fee: data.delivery_fee,
        total,
        payment_method: "COD",
        source: "web",
        status: "web_pending",
        created_by: data.created_by ?? null,
      })
      .select("id")
      .single();

    if (orderRes.error || !orderRes.data) {
      throw new Error(orderRes.error?.message ?? "Order create failed");
    }
    const order = orderRes.data;
    const validIds = new Set((dbProducts ?? []).map((r) => r.id));

    const rows = safeItems.map((i) => ({
      order_id: order.id,
      product_id: validIds.has(i.id) ? i.id : null,
      product_name: i.name,
      price: i.price,
      quantity: i.quantity,
      subtotal: i.price * i.quantity,
    }));

    // Insert items + cleanup incomplete row + log conversion in parallel
    const [itemsRes, delRes] = await Promise.all([
      supabaseAdmin.from("order_items").insert(rows),
      supabaseAdmin.from("incomplete_orders").delete().eq("phone", customerPhone).select("id"),
    ]);

    if (itemsRes.error) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsRes.error.message);
    }

    // If there was an incomplete row for this phone, log it as "converted"
    if ((delRes.data ?? []).length > 0) {
      await supabaseAdmin.from("incomplete_events").insert({ phone: customerPhone, event: "converted" });
    }

    // Fire Facebook CAPI Purchase server-side (fire-and-forget — never block checkout).
    try {
      const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
      const userAgent = getRequestHeader("user-agent") ?? null;
      // IMPORTANT: must await — Cloudflare Workers terminate background
      // promises after the response is sent, so fire-and-forget drops the
      // CAPI call. sendPurchaseEvent swallows its own errors.
      await sendPurchaseEvent({
        orderId: order.id,
        value: total,
        currency: "BDT",
        phone: customerPhone,
        name: data.customer_name,
        city: data.district ?? data.thana ?? null,
        country: "bd",
        contents: safeItems.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
        clientIp,
        userAgent,
        fbp: data.fbp ?? null,
        fbc: data.fbc ?? null,
        eventSourceUrl: data.source_url ?? null,
      });
    } catch (e) {
      console.error("[placeOrder] CAPI dispatch failed:", e);
    }

    return { id: order.id };
  });
