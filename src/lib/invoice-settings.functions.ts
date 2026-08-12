import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertCanManageOrders, assertIsAdmin } from "@/lib/_admin-guard.server";

export const INVOICE_INTEGRATION = "invoice_settings";

export const getInvoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanManageOrders(context.userId);
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("name", INVOICE_INTEGRATION)
      .maybeSingle();
    const cfg = (data?.config as { prefix?: string; next?: number } | undefined) ?? {};
    return { prefix: cfg.prefix ?? "AA", next: Number(cfg.next ?? 1) };
  });

export const saveInvoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        prefix: z.string().trim().min(1).max(10),
        next: z.number().int().min(1).max(10_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.userId);
    const { error } = await supabaseAdmin.from("integrations").upsert(
      {
        name: INVOICE_INTEGRATION,
        is_active: true,
        config: { prefix: data.prefix, next: data.next },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
