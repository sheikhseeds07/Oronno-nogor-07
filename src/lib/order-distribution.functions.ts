import { createServerFn } from "@tanstack/react-start";
import { assertAdminOrPermission } from "@/lib/_admin-guard.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const Ids = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), userId: z.string().uuid() });
const MemberId = z.object({ userId: z.string().uuid() });
const Members = z.object({ members: z.array(z.object({ user_id: z.string().uuid(), name: z.string().min(1), enabled: z.boolean(), position: z.number().int().min(0) })).max(100) });
const DistributionSettings = Members.extend({ enabled: z.boolean(), includeIncomplete: z.boolean() });

const PROCESSING_STATUS = "web_pending" as const;

export const bulkAssignOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(Ids.parse).handler(async ({ data, context }) => {
  await assertAdminOrPermission(context.userId, "employees");
  const { data: employee, error: employeeError } = await supabaseAdmin.from("employees").select("user_id").eq("user_id", data.userId).eq("is_active", true).maybeSingle();
  if (employeeError) throw new Error(employeeError.message);
  if (!employee?.user_id) throw new Error("Selected employee is not active");
  const { error } = await supabaseAdmin.from("orders").update({ assigned_to: data.userId, updated_at: new Date().toISOString() }).in("id", data.ids).eq("status", PROCESSING_STATUS);
  if (error) throw new Error(error.message);
  return { ok: true, count: data.ids.length };
});

export const getAssignedOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(MemberId).handler(async ({ data, context }) => {
  await assertEmployeeManagementAccess(context.userId);
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id,invoice_id,customer_name,phone,total,status,created_at,assigned_to")
    .eq("assigned_to", data.userId)
    .eq("status", PROCESSING_STATUS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return orders ?? [];
});

export const saveOrderDistributionMembers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(Members.parse).handler(async ({ data, context }) => {
  await assertEmployeeManagementAccess(context.userId);
  const { data: employees, error: employeesError } = await supabaseAdmin.from("employees").select("user_id,name").eq("is_active", true).not("user_id", "is", null);
  if (employeesError) throw new Error(employeesError.message);
  const allowed = new Set((employees ?? []).map(e => e.user_id).filter(Boolean));
  for (const m of data.members) {
    if (!allowed.has(m.user_id)) continue;
    const { error } = await supabaseAdmin.from("order_distribution_members").upsert({ user_id: m.user_id, name: m.name, enabled: m.enabled, position: m.position, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
});

export const saveOrderDistributionSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(DistributionSettings.parse).handler(async ({ data, context }) => {
  await assertEmployeeManagementAccess(context.userId);
  const { data: current, error: readError } = await supabaseAdmin.from("site_settings").select("id,settings").maybeSingle();
  if (readError) throw new Error(readError.message);
  const settings = { ...((current?.settings ?? {}) as Record<string, unknown>), order_distribution_enabled: data.enabled, order_distribution_include_incomplete: data.includeIncomplete };
  const result = current?.id
    ? await supabaseAdmin.from("site_settings").update({ settings: settings as never }).eq("id", current.id)
    : await supabaseAdmin.from("site_settings").insert({ settings: settings as never });
  if (result.error) throw new Error(result.error.message);
  const { data: employees, error: employeesError } = await supabaseAdmin.from("employees").select("user_id").eq("is_active", true).not("user_id", "is", null);
  if (employeesError) throw new Error(employeesError.message);
  const allowed = new Set((employees ?? []).map(e => e.user_id).filter(Boolean));
  for (const member of data.members) {
    if (!allowed.has(member.user_id)) continue;
    const { error } = await supabaseAdmin.from("order_distribution_members").upsert({ ...member, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
});

export const getOrderAssignmentCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(Members.pick({ members: true }))
  .handler(async ({ data, context }) => {
    await assertEmployeeManagementAccess(context.userId);
    const counts: Record<string, number> = {};
    await Promise.all(data.members.map(async (member) => {
      const { count, error } = await supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", member.user_id)
        .eq("status", PROCESSING_STATUS);
      if (error) throw new Error(error.message);
      counts[member.user_id] = count ?? 0;
    }));
    return counts;
  });
