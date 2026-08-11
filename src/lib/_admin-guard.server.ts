// Shared server-side authorization helpers for staff/admin server functions.
// Always import from a server-only path; never imported by client code.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

export async function assertIsStaff(userId: string): Promise<void> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const names = new Set((roles ?? []).map((r) => r.role));
  if (names.has("super_admin") || names.has("admin") || names.has("employee")) return;
  throw new Error("Unauthorized");
}

export async function assertCanManageOrders(userId: string): Promise<void> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const names = new Set((roles ?? []).map((r) => r.role));
  if (names.has("super_admin") || names.has("admin")) return;
  const { data: perms } = await supabaseAdmin
    .from("employee_permissions")
    .select("orders,web_orders")
    .eq("user_id", userId)
    .maybeSingle();
  if (perms?.orders || perms?.web_orders) return;
  throw new Error("Unauthorized");
}

export async function assertIsAdmin(userId: string): Promise<void> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const names = new Set((roles ?? []).map((r) => r.role));
  if (names.has("super_admin") || names.has("admin")) return;
  throw new Error("Unauthorized");
}
