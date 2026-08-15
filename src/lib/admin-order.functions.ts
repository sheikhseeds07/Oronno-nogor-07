import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders, assertIsAdmin } from "@/lib/_admin-guard.server";

export const getAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ id: z.string().uuid() })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*), order_status_logs(*)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return order;
  });

export const listAdminOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(
    z.object({
      status: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
      search: z.string().optional(),
      courier: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  ))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    let query = supabaseAdmin.from("orders").select("*, order_items(quantity)", { count: "exact" });

    if (data.status) query = query.eq("status", data.status as any);
    // courier_name might be missing, checking courier_consignment instead if that was the intent
    // or just skipping if column is definitely missing. Types show 'courier_consignment' exists.
    if (data.search) {
      const s = data.search.trim();
      query = query.or(`customer_phone.ilike.%${s}%,customer_name.ilike.%${s}%,invoice_no.ilike.%${s}%`);
    }
    if (data.dateFrom) query = query.gte("created_at", data.dateFrom);
    if (data.dateTo) query = query.lte("created_at", data.dateTo);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: orders, count, error } = await query.order("created_at", { ascending: false }).range(from, to);

    if (error) throw new Error(error.message);
    return { orders, total: count || 0 };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ id: z.string().uuid(), status: z.string(), note: z.string().optional() })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", data.id).single();
    if (!order) throw new Error("Order not found");

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status as any, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("order_status_logs").insert({
      order_id: data.id,
      changed_by: context.userId,
      from_status: order.status,
      to_status: data.status as any,
      note: data.note || `Status updated to ${data.status}`,
    });

    return { success: true };
  });

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ ids: z.array(z.string().uuid()), status: z.string(), note: z.string().optional() })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: orders } = await supabaseAdmin.from("orders").select("id, status").in("id", data.ids);

    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status as any, updated_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    if (orders) {
      const historyEntries = orders.map((o) => ({
        order_id: o.id,
        changed_by: context.userId,
        from_status: o.status,
        to_status: data.status as any,
        note: data.note || `Bulk status update to ${data.status}`,
      }));
      await supabaseAdmin.from("order_status_logs").insert(historyEntries as any);
    }

    return { success: true };
  });

export const deleteOrderPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ id: z.string().uuid() })))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.userId);
    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const createManualOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({
    customer_name: z.string(),
    customer_phone: z.string(),
    customer_address: z.string().nullable(),
    thana: z.string().nullable(),
    district: z.string().nullable(),
    notes: z.string().nullable(),
    subtotal: z.number(),
    delivery_fee: z.number(),
    discount: z.number(),
    total: z.number(),
    items: z.array(z.object({
      product_id: z.string().uuid().nullable(),
      product_name: z.string(),
      price: z.number(),
      quantity: z.number(),
    })),
  })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        thana: data.thana,
        district: data.district,
        notes: data.notes,
        subtotal: data.subtotal,
        delivery_fee: data.delivery_fee,
        discount: data.discount,
        total: data.total,
        source: "manual",
        status: "pending",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (orderError) throw new Error(orderError.message);

    const itemRows = data.items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      product_name: it.product_name,
      price: it.price,
      quantity: it.quantity,
      subtotal: it.price * it.quantity,
    }));
    const { error: itemErr } = await supabaseAdmin.from("order_items").insert(itemRows);
    if (itemErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemErr.message);
    }
    return { id: order.id };
  });

export const updateAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({
    id: z.string().uuid(),
    updates: z.object({
      customer_name: z.string().optional(),
      customer_phone: z.string().optional(),
      customer_address: z.string().optional(),
      thana: z.string().optional().nullable(),
      district: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      subtotal: z.number().optional(),
      delivery_fee: z.number().optional(),
      discount: z.number().optional(),
      total: z.number().optional(),
      items: z.array(z.object({
        product_id: z.string().uuid().nullable(),
        product_name: z.string(),
        price: z.number(),
        quantity: z.number(),
      })).optional(),
    }).optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    customer_address: z.string().optional(),
    thana: z.string().optional().nullable(),
    district: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    subtotal: z.number().optional(),
    delivery_fee: z.number().optional(),
    discount: z.number().optional(),
    total: z.number().optional(),
    items: z.array(z.object({
      product_id: z.string().uuid().nullable(),
      product_name: z.string(),
      price: z.number(),
      quantity: z.number(),
    })).optional(),
    confirm: z.boolean().optional(),
  })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { id, confirm, updates, ...flatUpdates } = data;
    const finalUpdates = { ...updates, ...flatUpdates };
    const { items, ...dbUpdates } = finalUpdates;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from("orders")
        .update(dbUpdates as any)
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    if (items) {
      await supabaseAdmin.from("order_items").delete().eq("order_id", id);
      const itemRows = items.map((it) => ({
        order_id: id,
        product_id: it.product_id,
        product_name: it.product_name,
        price: it.price,
        quantity: it.quantity,
        subtotal: it.price * it.quantity,
      }));
      await supabaseAdmin.from("order_items").insert(itemRows);
    }

    if (confirm) {
      await supabaseAdmin.from("orders").update({ status: "pending" }).eq("id", id);
    }

    return { success: true };
  });


export const markOrdersPrinted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ ids: z.array(z.string().uuid()) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ printed_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ ids: z.array(z.string().uuid()) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { error } = await supabaseAdmin.from("orders").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { success: true, deleted: data.ids.length };
  });


export const cancelOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ ids: z.array(z.string().uuid()) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { success: true };
  });

