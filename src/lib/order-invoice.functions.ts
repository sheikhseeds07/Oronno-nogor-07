import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertCanManageOrders } from "@/lib/_admin-guard.server";

/** Reserves invoice numbers (AA1, AA2, ...) for orders about to be created. */
export const reserveInvoiceNos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ count: z.number().int().min(1).max(200).default(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { allocateInvoiceNos } = await import("@/lib/invoice-no.server");
    return { invoices: await allocateInvoiceNos(data.count) };
  });

/** Gives every listed order a valid invoice number before its status changes. */
export const ensureOrderInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCanManageOrders(context.userId);
    const { ensureInvoicesForOrders } = await import("@/lib/invoice-no.server");
    return { invoices: await ensureInvoicesForOrders(data.ids) };
  });
