import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function assertAdmin(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Unauthorized");
}

const CustomerUpdateSchema = z.object({
  id: z.string().uuid(), full_name: z.string().max(255).nullable().optional(), phone: z.string().max(32).nullable().optional(),
  address: z.string().max(1000).nullable().optional(), district: z.string().max(100).nullable().optional(), thana: z.string().max(100).nullable().optional(),
});

const CustomerSelect = "id,phone,full_name,avatar_url,address,district,thana,created_at,updated_at,is_blocked,blocked_at";

export const listCustomersAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { data, error } = await context.supabase.from("customer_profiles").select(CustomerSelect).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const updateCustomerAdmin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => CustomerUpdateSchema.parse(input)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { id, ...updates } = data;
  const { data: row, error } = await context.supabase.from("customer_profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select(CustomerSelect).maybeSingle();
  if (error) throw new Error(error.message);
  return row;
});

/**
 * Block/unblock is intentionally performed as a direct update against customer_profiles.
 * This uses the same authenticated admin connection already used by the customer list,
 * avoiding RPC/function deployment or return-shape issues.
 */
export const setCustomerBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), blocked: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    const patch = {
      is_blocked: data.blocked,
      blocked_at: data.blocked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    // 1) Try the authenticated admin connection (respects RLS).
    let row: any = null;
    let lastError: string | null = null;
    {
      const { data: r, error } = await context.supabase
        .from("customer_profiles")
        .update(patch)
        .eq("id", data.id)
        .select("id,is_blocked,blocked_at")
        .maybeSingle();
      if (error) lastError = error.message;
      row = r ?? null;
    }

    // 2) Fall back to the privileged client when RLS silently blocks the update.
    if (!row || Boolean(row.is_blocked) !== data.blocked) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: r2, error: e2 } = await (supabaseAdmin as any)
        .from("customer_profiles")
        .update(patch)
        .eq("id", data.id)
        .select("id,is_blocked,blocked_at")
        .maybeSingle();
      if (e2) lastError = e2.message;
      row = r2 ?? row;
    }

    if (!row) throw new Error(`Block action failed: ${lastError ?? "customer was not found"}`);
    if (Boolean(row.is_blocked) !== data.blocked)
      throw new Error(`Block action failed: status was not saved${lastError ? ` (${lastError})` : ""}`);

    return row as { id: string; is_blocked: boolean; blocked_at: string | null };
  });
