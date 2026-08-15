import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";
import { allocateInvoiceNo, allocateInvoiceNos, ensureInvoicesForOrders } from "./invoice-no.server";


export const getNextInvoiceNo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageOrders(context.userId);
    const invoice = await allocateInvoiceNo();
    return { invoice_no: invoice };
  });

export const assignOrderInvoiceNo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ orderId: z.string().uuid() })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { data: order } = await supabaseAdmin.from("orders").select("invoice_no").eq("id", data.orderId).single();
    if (order?.invoice_no) return { invoice_no: order.invoice_no };

    const invoice = await allocateInvoiceNo();
    await supabaseAdmin.from("orders").update({ invoice_no: invoice }).eq("id", data.orderId);
    return { invoice_no: invoice };
  });

export const ensureOrderInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ ids: z.array(z.string().uuid()) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    return await ensureInvoicesForOrders(data.ids);
  });

export const reserveInvoiceNos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ count: z.number().min(1).max(500) })))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const invoices = await allocateInvoiceNos(data.count);
    return { invoices };
  });


