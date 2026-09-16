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

    let skipped = 0;
    const errors: string[] = [];

    // --- Duplicate refs: ONE query for all refs (Worker subrequest limit) ---
    const refs = data.orders.map((o) => o.order_ref?.trim() || null).filter(Boolean) as string[];
    const existingRefs = new Set<string>();
    if (refs.length) {
      const orFilter = refs
        .map((r) => `notes.ilike.%${r.replace(/[,()]/g, "")}%`)
        .join(",");
      const { data: dups } = await supabaseAdmin.from("orders").select("notes").or(orFilter);
      for (const row of dups ?? []) {
        const notes = String(row.notes ?? "");
        for (const r of refs) if (notes.includes(r)) existingRefs.add(r);
      }
    }

    // --- Build all rows in memory ---
    const prepared: Array<{
      name: string;
      order: {
        customer_name: string;
        customer_phone: string;
        customer_address: string | null;
        notes: string | null;
        subtotal: number;
        delivery_fee: number;
        discount: number;
        total: number;
        source: "manual";
        status: "pending";
        payment_method: "cod";
      };
      items: Array<{
        product_id: string | null;
        product_name: string;
        price: number;
        quantity: number;
        subtotal: number;
      }>;
    }> = [];


    for (const o of data.orders) {
      const ref = o.order_ref?.trim() || null;
      if (ref && existingRefs.has(ref)) { skipped++; continue; }

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

      prepared.push({
        name: o.customer_name,
        items,
        order: {
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
        },
      });
    }

    type PrevOrder = {
      id: string;
      invoice_no: string | null;
      customer_name: string;
      customer_phone: string;
      status: string;
      courier_status: string | null;
      total: number;
      created_at: string;
    };

    if (!prepared.length) return { imported: 0, skipped, errors, previous: [] as PrevOrder[] };

    // --- One invoice allocation for the whole batch ---
    const { allocateInvoiceNos } = await import("@/lib/invoice-no.server");
    const invoices = await allocateInvoiceNos(prepared.length);

    // --- Bulk insert orders + items in a few chunked requests ---
    const CHUNK = 100;
    let imported = 0;
    const createdIds: string[] = [];
    for (let i = 0; i < prepared.length; i += CHUNK) {
      const chunk = prepared.slice(i, i + CHUNK);
      const rows = chunk.map((p, idx) => ({ ...p.order, invoice_no: invoices[i + idx] }));
      const { data: created, error } = await supabaseAdmin.from("orders").insert(rows).select("id");
      if (error || !created || created.length !== chunk.length) {
        errors.push(`${chunk[0]?.name ?? "অর্ডার"}: ${error?.message ?? "তৈরি হয়নি"}`);
        continue;
      }
      const itemRows = chunk.flatMap((p, idx) =>
        p.items.map((it) => ({ ...it, order_id: created[idx].id })),
      );
      const { error: itemErr } = await supabaseAdmin.from("order_items").insert(itemRows);
      if (itemErr) {
        await supabaseAdmin.from("orders").delete().in("id", created.map((c) => c.id));
        errors.push(`${chunk[0]?.name ?? "অর্ডার"}: ${itemErr.message}`);
        continue;
      }
      imported += chunk.length;
      createdIds.push(...created.map((c) => c.id));
    }

    // --- Earlier orders from the same phone numbers (one query) ---
    let previous: PrevOrder[] = [];
    const phones = [...new Set(prepared.map((p) => p.order.customer_phone))];
    if (phones.length) {
      const { data: prevRows } = await supabaseAdmin
        .from("orders")
        .select("id,invoice_no,customer_name,customer_phone,status,courier_status,total,created_at")
        .in("customer_phone", phones)
        .order("created_at", { ascending: false })
        .limit(300);
      const newSet = new Set(createdIds);
      previous = (prevRows ?? [])
        .filter((r) => !newSet.has(r.id))
        .map((r) => ({
          id: r.id,
          invoice_no: r.invoice_no ?? null,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          status: String(r.status),
          courier_status: r.courier_status ?? null,
          total: Number(r.total) || 0,
          created_at: r.created_at ?? new Date().toISOString(),
        }));
    }

    return { imported, skipped, errors, previous };
  });


