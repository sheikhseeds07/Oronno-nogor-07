import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const PermSchema = z.object({
  attendance: z.boolean().default(false),
  employees: z.boolean().default(false),
  offers: z.boolean().default(false),
  banners: z.boolean().default(false),
  coupons: z.boolean().default(false),
  orders: z.boolean().default(false),
  web_orders: z.boolean().default(false),
  new_order: z.boolean().default(false),
  products: z.boolean().default(false),
  categories: z.boolean().default(false),
  customers: z.boolean().default(false),
  marketing: z.boolean().default(false),
  delivery: z.boolean().default(false),
  reports: z.boolean().default(false),
  hrm: z.boolean().default(false),
  settings: z.boolean().default(false),
  landing_pages: z.boolean().default(false),
  all_api: z.boolean().default(false),
  messages: z.boolean().default(false),
  dashboard: z.boolean().default(true),
  dashboard_live_visitors: z.boolean().default(true),
  dashboard_web_orders: z.boolean().default(true),
  dashboard_incomplete_orders: z.boolean().default(true),
  dashboard_stock_alert: z.boolean().default(true),
  dashboard_confirmed_sell: z.boolean().default(true),
  dashboard_meta_ads: z.boolean().default(true),
  dashboard_time_filter: z.boolean().default(true),
});

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

async function assertAdmin(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Unauthorized");
}

async function assertSuperAdmin(db: any, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Unauthorized");
}

async function invokeAdminBridge(db: any, body: Record<string, unknown>) {
  const { data, error } = await db.functions.invoke("admin-bridge", { body });
  if (error) throw new Error(error.message || "Admin operation failed");
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export const createEmployee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => CreateSchema.parse(input)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  if (data.role !== "employee") await assertSuperAdmin(context.supabase, context.userId);
  return invokeAdminBridge(context.supabase, { action: "employee_create", ...data });
});

export const updateEmployeePermissions = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid(), permissions: PermSchema }).parse(input)).handler(async ({ data, context }) => {
  await assertSuperAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.from("employee_permissions").upsert({ user_id: data.user_id, ...data.permissions, updated_at: new Date().toISOString() }, { onConflict: "user_id" } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
});

export const deleteEmployee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ employee_id: z.string().uuid() }).parse(input)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  return invokeAdminBridge(context.supabase, { action: "employee_delete", employee_id: data.employee_id });
});

export const resetEmployeePassword = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(128) }).parse(input)).handler(async ({ data, context }) => {
  await assertAdmin(context.supabase, context.userId);
  return invokeAdminBridge(context.supabase, { action: "employee_reset_password", ...data });
});

export const updateEmployeeRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid(), role: z.enum(["super_admin", "admin", "employee"]) }).parse(input)).handler(async ({ data, context }) => {
  await assertSuperAdmin(context.supabase, context.userId);
  return invokeAdminBridge(context.supabase, { action: "employee_update_role", ...data });
});

export const listEmployeesFull = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  await assertAdmin(db, context.userId);
  const { data: emps, error: empError } = await db.from("employees").select("*").order("created_at", { ascending: false });
  if (empError) throw new Error(empError.message);
  const ids = (emps ?? []).map((e: any) => e.user_id).filter(Boolean) as string[];
  const [{ data: perms, error: permError }, { data: roles, error: roleError }] = ids.length ? await Promise.all([db.from("employee_permissions").select("*").in("user_id", ids), db.from("user_roles").select("*").in("user_id", ids)]) : [{ data: [], error: null }, { data: [], error: null }];
  if (permError) throw new Error(permError.message);
  if (roleError) throw new Error(roleError.message);
  const permMap = new Map((perms ?? []).map((p: any) => [p.user_id, p]));
  const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
  return (emps ?? []).map((e: any) => ({ ...e, role: e.user_id ? roleMap.get(e.user_id) ?? "employee" : "employee", permissions: (e.user_id ? permMap.get(e.user_id) ?? null : null) as (EmployeePermissions & { user_id: string }) | null }));
});
