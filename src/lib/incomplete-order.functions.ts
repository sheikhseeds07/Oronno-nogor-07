import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";

const PHONE_RE = /^01[3-9][0-9]{8}$/;

const ItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(500),
  price: z.number().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1000),
});

const UpsertSchema = z.object({
  checkout_session_id: z.string().uuid(),
  phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number"),
  customer_name: z.string().max(255).optional().nullable(),
  customer_address: z.string().max(1000).optional().nullable(),
  delivery_zone: z.string().max(50).optional().nullable(),
  delivery_fee: z.number().min(0).max(10000).default(0),
  items: z.array(ItemSchema).max(100).default([]),
  subtotal: z.number().min(0).max(100_000_000).default(0),
  total: z.number().min(0).max(100_000_000).default(0),
  note: z.string().max(2000).optional().nullable(),
});

// Order statuses that mean "this phone already has an active order in progress".
const ACTIVE_STATUSES = ["web_pending", "pending", "hold", "rts"] as const;

export const upsertIncompleteOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = data.phone;
    const checkoutSessionId = data.checkout_session_id;

    // Keep the previous behavior of skipping a draft when this phone already has
    // an active order, but only remove the draft belonging to this checkout.
    const { data: active } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_phone", phone)
      .in("status", ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();

    if (active) {
      await supabaseAdmin
        .from("incomplete_orders")
        .delete()
        .eq("checkout_session_id", checkoutSessionId);
      return { ok: true, skipped: "active_order_exists" as const };
    }

    const row = {
      checkout_session_id: checkoutSessionId,
      phone,
      customer_name: data.customer_name ?? null,
      customer_address: data.customer_address ?? null,
      delivery_zone: data.delivery_zone ?? null,
      delivery_fee: data.delivery_fee,
      items: data.items,
      subtotal: data.subtotal,
      total: data.total,
      note: data.note ?? null,
      updated_at: new Date().toISOString(),
    };

    // Check by stable checkout id, not phone. Changing phone now updates the same row.
    const { data: existing } = await supabaseAdmin
      .from("incomplete_orders")
      .select("id")
      .eq("checkout_session_id", checkoutSessionId)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      // Backward compatibility: if a legacy phone-keyed draft exists, adopt it
      // into this checkout session instead of creating a second row.
      const { data: legacy } = await supabaseAdmin
        .from("incomplete_orders")
        .select("id")
        .eq("phone", phone)
        .is("checkout_session_id", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacy) {
        const { error } = await supabaseAdmin
          .from("incomplete_orders")
          .update(row)
          .eq("id", legacy.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
    }

    const { error } = await supabaseAdmin
      .from("incomplete_orders")
      .upsert(row, { onConflict: "checkout_session_id" });
    if (error) throw new Error(error.message);

    if (!existing) {
      await supabaseAdmin.from("incomplete_events").insert({ phone, event: "created" });
    }
    return { ok: true };
  });

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") }).parse(input))
  .handler(async ({ data }) => {
    const phone = data.phone;
    // Most recent completed (non-web_pending) order
    const { data: ord } = await supabaseAdmin
      .from("orders")
      .select("customer_name,customer_address")
      .eq("customer_phone", phone)
      .neq("status", "web_pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ord) return { name: ord.customer_name, address: ord.customer_address };
    // Fallback: any order (incl. pending)
    const { data: any } = await supabaseAdmin
      .from("orders")
      .select("customer_name,customer_address")
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return any ? { name: any.customer_name, address: any.customer_address } : null;
  });

export const deleteIncompleteByPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    await supabaseAdmin.from("incomplete_orders").delete().eq("phone", data.phone);
    return { ok: true };
  });
