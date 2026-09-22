import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

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

async function loadRole(db: any, userId: string): Promise<string | null> {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const names = new Set((data ?? []).map((r: any) => r.role as string));
  if (names.has("super_admin")) return "super_admin";
  if (names.has("admin")) return "admin";
  if (names.has("employee")) return "employee";
  return null;
}

/** Only the CEO may hand out roles or module permissions. */
async function assertSuperAdmin(db: any, userId: string) {
  if ((await loadRole(db, userId)) !== "super_admin") throw new Error("শুধু CEO এই কাজটি করতে পারবেন");
}

/** CEO, or staff the CEO granted the Employees module. */
async function assertHrm(db: any, userId: string) {
  const role = await loadRole(db, userId);
  if (!role) throw new Error("Unauthorized");
  if (role === "super_admin") return;
  const { data, error } = await db.from("employee_permissions").select("employees").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.employees) throw new Error("Unauthorized");
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
    const { error } = await context.supabase.from("employee_permissions").upsert(
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
    return invokeAdminBridge(context.supabase, { action: "employee_delete", employee_id: data.employee_id });
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

    // Employee directory reads use a SECURITY DEFINER RPC so the existing
    // employee data is returned without exposing a service-role key to the app.
    const { data, error } = await db.rpc("list_employees_full");
    if (error) throw new Error(error.message);
    return (data ?? []).map((e: any) => ({
      ...e,
      role: e.role ?? "employee",
      permissions: e.permissions && Object.keys(e.permissions).length
        ? { user_id: e.user_id, ...e.permissions }
        : null,
    }));
  });
