import { EMPLOYEES_COLUMNS, EMPLOYEE_PERMISSIONS_COLUMNS, USER_ROLES_COLUMNS } from "@/lib/read-columns";
import { assertIsSuperAdmin, assertPermission } from "@/lib/_admin-guard.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const PERM_KEYS = ["dashboard","orders","order_import","products","offers","categories","customers","banners","coupons","landing_pages","employees","all_api","settings","dash_visitors","dash_web_orders","dash_incomplete","dash_confirmed_sales","dash_stock_alerts","dash_ads","dash_top_selling","dash_employee_perf","dash_stock_control","dash_hourly"] as const;
const PermSchema = z.object(Object.fromEntries(PERM_KEYS.map((k) => [k, z.boolean().default(false)])) as Record<(typeof PERM_KEYS)[number], z.ZodDefault<z.ZodBoolean>>);

export type EmployeePermissions = z.infer<typeof PermSchema>;

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(3).max(32),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  position: z.string().max(100).optional().default(""),
  role: z.enum(["super_admin", "admin", "employee"]).default("employee"),
  permissions: PermSchema,
});

/** Only the CEO may hand out roles or module permissions. */
async function assertSuperAdmin(_db: any, userId: string) {
  try { await assertIsSuperAdmin(userId); }
  catch { throw new Error("শুধু CEO এই কাজটি করতে পারবেন"); }
}

/** CEO, or staff the CEO granted the Employees module. */
async function assertHrm(_db: any, userId: string) {
  await assertPermission(userId, "employees");
}

async function invokeAdminBridge(db: any, body: Record<string, unknown>) {
  const { data, error } = await db.functions.invoke("admin-bridge", { body });
  if (error) throw new Error(error.message || "Admin operation failed");
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return invokeAdminBridge(context.supabase, { action: "employee_create", ...data });
  });

export const updateEmployeePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), permissions: PermSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("employee_permissions" as any).upsert(
      { user_id: data.user_id, ...data.permissions, updated_at: new Date().toISOString() },
      { onConflict: "user_id" } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ employee_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertHrm(context.supabase, context.userId);
    const { data: result, error } = await context.supabase.functions.invoke("employee-delete", {
      body: { employee_id: data.employee_id },
    });
    if (error) {
      // Supabase FunctionsHttpError stores the Edge Function response in context.
      // Read its JSON body so expected business-rule errors (HTTP 409) reach the UI
      // instead of showing the generic "Edge Function returned a non-2xx status code".
      let functionMessage: string | undefined;
      const response = (error as any).context;
      if (response && typeof response.clone === "function") {
        try {
          const payload = await response.clone().json();
          if (typeof payload?.error === "string" && payload.error.trim()) {
            functionMessage = payload.error.trim();
          }
        } catch {
          // Fall back to the Supabase error message when no JSON body is available.
        }
      }
      throw new Error(functionMessage || error.message || "Employee delete failed");
    }
    if (result?.error) throw new Error(String(result.error));
    if (result?.ok !== true) throw new Error("Employee delete was not confirmed");
    return result;
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertHrm(context.supabase, context.userId);
    return invokeAdminBridge(context.supabase, { action: "employee_reset_password", ...data });
  });

export const updateEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), role: z.enum(["super_admin", "admin", "employee"]) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return invokeAdminBridge(context.supabase, { action: "employee_update_role", ...data });
  });

export const listEmployeesFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    await assertHrm(db, context.userId);
    const { data: emps, error: empError } = await db.from("employees").select(EMPLOYEES_COLUMNS).order("created_at", { ascending: false }).limit(200);
    if (empError) throw new Error(empError.message);
    const ids = (emps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
    const [{ data: perms, error: permError }, { data: roles, error: roleError }] = ids.length
      ? await Promise.all([
          db.from("employee_permissions").select(EMPLOYEE_PERMISSIONS_COLUMNS).in("user_id", ids).limit(500),
          db.from("user_roles").select(USER_ROLES_COLUMNS).in("user_id", ids).limit(500),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (permError) throw new Error(permError.message);
    if (roleError) throw new Error(roleError.message);
    const permMap = new Map((perms ?? []).map((p: any) => [p.user_id, p]));
    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    return (emps ?? []).map((e: any) => ({
      ...e,
      role: e.user_id ? roleMap.get(e.user_id) ?? "employee" : "employee",
      permissions: (e.user_id ? permMap.get(e.user_id) ?? null : null) as (EmployeePermissions & { user_id: string }) | null,
    }));
  });
