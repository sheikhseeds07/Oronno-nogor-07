import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const PermSchema = z.object({
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
});

export type EmployeePermissions = z.infer<typeof PermSchema>;

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(3).max(32),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  position: z.string().max(100).optional().default(""),
  permissions: PermSchema,
});

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .limit(1);
  if (!data?.length) throw new Error("Unauthorized");
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone },
    });
    if (createErr || !created?.user) throw new Error(createErr?.message || "Auth user create failed");

    const uid = created.user.id;

    // Profile (handle_new_user trigger should also do this, but upsert to be sure)
    await supabaseAdmin.from("profiles").upsert(
      { id: uid, full_name: data.name, phone: data.phone },
      { onConflict: "id" },
    );

    // Role: employee
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: uid, role: "employee" } as never,
      { onConflict: "user_id,role" } as never,
    );

    // Permissions
    await supabaseAdmin.from("employee_permissions").upsert(
      { user_id: uid, ...data.permissions, updated_at: new Date().toISOString() },
      { onConflict: "user_id" } as never,
    );

    // Employees row
    await supabaseAdmin.from("employees").insert({
      name: data.name,
      phone: data.phone,
      email: data.email,
      position: data.position || null,
      is_active: true,
      user_id: uid,
    } as never);

    return { ok: true, user_id: uid };
  });

export const updateEmployeePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), permissions: PermSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("employee_permissions").upsert(
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
    await assertAdmin(context.userId);
    const { data: emp } = await supabaseAdmin.from("employees").select("user_id").eq("id", data.employee_id).maybeSingle();
    await supabaseAdmin.from("employees").delete().eq("id", data.employee_id);
    if (emp?.user_id) {
      await supabaseAdmin.from("employee_permissions").delete().eq("user_id", emp.user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", emp.user_id);
      await supabaseAdmin.auth.admin.deleteUser(emp.user_id).catch(() => undefined);
    }
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), password: z.string().min(6).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployeesFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    const ids = (emps ?? []).map((e) => e.user_id).filter(Boolean) as string[];
    const { data: perms } = ids.length
      ? await supabaseAdmin.from("employee_permissions").select("*").in("user_id", ids)
      : { data: [] as Array<{ user_id: string }> };
    const permMap = new Map((perms ?? []).map((p) => [p.user_id, p as unknown as EmployeePermissions & { user_id: string }]));
    return (emps ?? []).map((e) => ({
      ...e,
      permissions: (e.user_id ? permMap.get(e.user_id) ?? null : null) as (EmployeePermissions & { user_id: string }) | null,
    }));
  });
