import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";


const PHONE_RE = /^(?:\+?88)?01[0-9]{9}$/;
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

const UpsertSchema = z.object({
  phone: z.string().min(11).max(20).refine((value) => PHONE_RE.test(normPhone(value)), "Invalid phone number"),
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
// If any of these exist, we do NOT keep an incomplete row for the same phone.
const ACTIVE_STATUSES = ["web_pending", "pending", "hold", "rts"] as const;

export const upsertIncompleteOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => UpsertSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = normPhone(data.phone);

    // Dedup: if this phone already has an active order, do not create/keep an incomplete row
    const { data: active } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_phone", phone)
      .in("status", ACTIVE_STATUSES)
      .limit(1)
      .maybeSingle();

    if (active) {
      await supabaseAdmin.from("incomplete_orders").delete().eq("phone", phone);
      return { ok: true, skipped: "active_order_exists" as const };
    }

    // Was there already an incomplete row? (decides if this is a NEW create or an update)
    const { data: existing } = await supabaseAdmin
      .from("incomplete_orders")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("incomplete_orders")
      .upsert(
        {
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
        },
        { onConflict: "phone" },
      );
    if (error) throw new Error(error.message);

    if (!existing) {
      await supabaseAdmin.from("incomplete_events").insert({ phone, event: "created" });
    }
    return { ok: true };
  });

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(11).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const phone = normPhone(data.phone);
    if (!PHONE_RE.test(phone)) return null;
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
  .inputValidator((input) => z.object({ phone: z.string().min(11).max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const phone = normPhone(data.phone);
    await supabaseAdmin.from("incomplete_orders").delete().eq("phone", phone);
    return { ok: true };
  });
