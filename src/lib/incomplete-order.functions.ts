import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
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
  checkout_session_id: z.string().uuid().optional().nullable(),
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

const ACTIVE_STATUSES = ["web_pending", "pending", "hold", "rts"] as const;

export const upsertIncompleteOrder = createServerFn({ method: "POST" })
  .validator(zodValidator(UpsertSchema))
  .handler(async ({ data }) => {
    const phone = data.phone;
    
    const { data: active } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_phone", phone)
      .in("status", ACTIVE_STATUSES as any)
      .limit(1)
      .maybeSingle();

    if (active) {
      if (data.phone) {
        await supabaseAdmin.from("incomplete_orders").delete().eq("phone", data.phone);
      }
      return { ok: true, skipped: "active_order_exists" as const };
    }

    const row: any = {
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

    const { data: existing } = await supabaseAdmin
      .from("incomplete_orders")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.from("incomplete_orders").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("incomplete_orders").insert(row);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("incomplete_events").insert({ phone, event: "created" });
    }
    
    return { ok: true };
  });

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .validator(zodValidator(z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") })))
  .handler(async ({ data }) => {
    const phone = data.phone;
    const { data: ord } = await supabaseAdmin
      .from("orders")
      .select("customer_name,customer_address")
      .eq("customer_phone", phone)
      .neq("status", "web_pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ord) return { name: ord.customer_name, address: ord.customer_address };
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
  .validator(zodValidator(z.object({ phone: z.string().regex(PHONE_RE, "Invalid Bangladesh mobile number") })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    await supabaseAdmin.from("incomplete_orders").delete().eq("phone", data.phone);
    return { ok: true };
  });
