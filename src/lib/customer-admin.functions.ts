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

export const setCustomerBlocked = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ id: z.string().uuid(), blocked: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  const { data: result, error } = await context.supabase.rpc("admin_set_customer_blocked_v2", {
    p_customer_id: data.id,
    p_blocked: data.blocked,
  });
  if (error) throw new Error(`Block action failed: ${error.message}`);
  if (!result?.id) throw new Error("Block action failed: customer was not updated");
  return result as { id: string; is_blocked: boolean; blocked_at: string | null };
});
