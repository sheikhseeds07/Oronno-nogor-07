import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const AdminItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_name: z.string().min(1).max(500),
  price: z.number().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1000),
});

const OrderFieldsSchema = z.object({
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().min(3).max(32),
  customer_address: z.string().max(1000).optional().nullable(),
  thana: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  subtotal: z.number().min(0).max(10_000_000),
  delivery_fee: z.number().min(0).max(100_000),
  discount: z.number().min(0).max(10_000_000).default(0),
  total: z.number().min(0).max(10_000_000),
  items: z.array(AdminItemSchema).min(1).max(100),
});

const ManualOrderSchema = OrderFieldsSchema;
const UpdateOrderSchema = OrderFieldsSchema.extend({
  id: z.string().uuid(),
  confirm: z.boolean().default(false),
});

const IdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export const markOrdersPrinted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IdsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ printed_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Soft-delete for admin UX: move the complete order, items and status history
 * into deleted_orders, then remove it from the active orders table.
 * Deleted Orders can restore it later.
 */
export const deleteOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IdsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: archived, error } = await (supabaseAdmin as any).rpc("archive_orders", {
      p_ids: data.ids,
      p_deleted_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, deleted: Number(archived ?? 0) };
  });

export const cancelOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IdsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, cancelled: data.ids.length };
  });

async function assertCanManageOrders(userId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roleNames = new Set((roles ?? []).map((r) => r.role));
  if (roleNames.has("super_admin") || roleNames.has("admin")) return;

  const { data: perms } = await supabaseAdmin
    .from("employee_permissions")
    .select("orders")
    .eq("user_id", userId)
    .maybeSingle();

  if (!perms?.orders) throw new Error("Unauthorized");
}

async function replaceOrderItems(orderId: string, items: z.infer<typeof AdminItemSchema>[]) {
  const { error: deleteError } = await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = items.map((item) => ({
    order_id: orderId,
    product_id: item.product_id ?? null,
    product_name: item.product_name,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
  }));

  const { error: insertError } = await supabaseAdmin.from("order_items").insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export const createManualOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ManualOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    const { allocateInvoiceNo } = await import("@/lib/invoice-no.server");
    const invoiceNo = await allocateInvoiceNo();

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        invoice_no: invoiceNo,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address ?? null,
        thana: data.thana ?? null,
        district: data.district ?? null,
        notes: data.notes ?? null,
        subtotal: data.subtotal,
        delivery_fee: data.delivery_fee,
        discount: data.discount,
        total: data.total,
        source: "manual",
        status: "pending",
        payment_method: "cod",
        created_by: context.userId,
      })
      .select("id,invoice_no")
      .single();

    if (error || !order) throw new Error(error?.message ?? "Order create failed");

    try {
      await replaceOrderItems(order.id, data.items);
    } catch (err) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw err;
    }

    return order;
  });

export const updateAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    if (data.confirm) {
      const { ensureInvoicesForOrders } = await import("@/lib/invoice-no.server");
      await ensureInvoicesForOrders([data.id]);
    }

    const updates = {
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_address: data.customer_address ?? null,
      thana: data.thana ?? null,
      district: data.district ?? null,
      notes: data.notes ?? null,
      subtotal: data.subtotal,
      delivery_fee: data.delivery_fee,
      discount: data.discount,
      total: data.total,
      ...(data.confirm ? { status: "pending" as const } : {}),
    };

    const { error } = await supabaseAdmin.from("orders").update(updates).eq("id", data.id);
    if (error) throw new Error(error.message);

    await replaceOrderItems(data.id, data.items);
    return { id: data.id, ok: true };
  });