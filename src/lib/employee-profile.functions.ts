import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  return !!data?.length;
}

export const getEmployeeProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid().optional() }).parse(input)).handler(async ({ data, context }) => {
  const targetId = data.user_id ?? context.userId;
  if (targetId !== context.userId && !(await isAdminUser(context.userId))) throw new Error("Unauthorized");
  const since = new Date(); since.setDate(since.getDate() - 30);
  const [{ data: profile }, { data: emp }] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", targetId).maybeSingle(),
    supabaseAdmin.from("employees").select("*").eq("user_id", targetId).maybeSingle(),
  ]);
  let total = 0, delivered = 0, cancelled = 0;
  try { const { data: orders } = await supabaseAdmin.from("orders").select("id,status,created_at").or(`assigned_to.eq.${targetId},created_by.eq.${targetId}`).gte("created_at", since.toISOString()).limit(1000); const ords = orders ?? []; total = ords.length; delivered = ords.filter((o) => o.status === "delivered").length; cancelled = ords.filter((o) => ["cancelled", "returned"].includes(o.status as string)).length; } catch {}
  return { profile, employee: emp as any, stats: { totalOrders: total, delivered, cancelled, score: Math.max(0, Math.min(100, delivered * 10 + (total - delivered - cancelled) * 2 - cancelled * 3)) } };
});
