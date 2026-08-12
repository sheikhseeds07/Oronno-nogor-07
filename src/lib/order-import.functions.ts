import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";

const ItemSchema = z.object({
  product_name: z.string().min(1).max(500),
  price: z.number().min(0).max(10_000_000),
  quantity: z.number().int().min(1).max(1000),
});

const OrderSchema = z.object({
  order_ref: z.string().max(120).optional().nullable(),
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().min(3).max(40),
  customer_address: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  total: z.number().min(0).max(10_000_000),
  items: z.array(ItemSchema).min(1).max(50),
});

export const importOrdersFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ orders: z.array(OrderSchema).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);

    // Match product names to real products so imported orders carry product links.
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id,name,price,sale_price");
    const productList = products ?? [];
    const findProduct = (name: string) => {
      const n = name.trim().toLowerCase();
      return (
        productList.find((p) => p.name.trim().toLowerCase() === n) ??
        productList.find((p) => n.includes(p.name.trim().toLowerCase()) || p.name.trim().toLowerCase().includes(n))
      );
    };

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const o of data.orders) {
      const ref = o.order_ref?.trim() || null;

      if (ref) {
        const { data: dup } = await supabaseAdmin
          .from("orders")
          .select("id")
          .ilike("notes", `%${ref}%`)
          .limit(1);
        if (dup && dup.length) { skipped++; continue; }
      }

      const items = o.items.map((it) => {
        const p = findProduct(it.product_name);
        const price = it.price > 0 ? it.price : Number(p?.sale_price ?? p?.price ?? 0);
        return {
          product_id: p?.id ?? null,
          product_name: p?.name ?? it.product_name,
          price,
          quantity: it.quantity,
          subtotal: price * it.quantity,
        };
      });

      const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
      const total = o.total > 0 ? o.total : subtotal;
      const deliveryFee = Math.max(0, total - subtotal);

      const notes = [o.notes?.trim() || null, ref ? `Ref: ${ref}` : null].filter(Boolean).join(" | ") || null;

      const { allocateInvoiceNo } = await import("@/lib/invoice-no.server");
      const invoiceNo = await allocateInvoiceNo();

      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .insert({
          invoice_no: invoiceNo,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          customer_address: o.customer_address ?? null,
          notes,
          subtotal,
          delivery_fee: deliveryFee,
          discount: 0,
          total,
          source: "manual",
          status: "pending",
          payment_method: "cod",
        })
        .select("id")
        .single();

      if (error || !order) {
        errors.push(`${o.customer_name}: ${error?.message ?? "তৈরি হয়নি"}`);
        continue;
      }

      const { error: itemErr } = await supabaseAdmin
        .from("order_items")
        .insert(items.map((it) => ({ ...it, order_id: order.id })));

      if (itemErr) {
        await supabaseAdmin.from("orders").delete().eq("id", order.id);
        errors.push(`${o.customer_name}: ${itemErr.message}`);
        continue;
      }

      imported++;
    }

    return { imported, skipped, errors };
  });
