import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function isSuperAdminUser(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").limit(1);
  return !!data?.length;
}
async function isAdminUser(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  return !!data?.length;
}
async function doCheckIn(targetUserId: string) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { data: existing } = await supabaseAdmin.from("attendance").select("id,check_out").eq("user_id", targetUserId).gte("check_in", startOfDay.toISOString()).order("check_in", { ascending: false }).limit(1).maybeSingle();
  if (existing && !existing.check_out) return { ok: true, id: existing.id, already: true };
  const { data, error } = await supabaseAdmin.from("attendance").insert({ user_id: targetUserId, check_in: new Date().toISOString() }).select("id").single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id, already: false };
}
async function doCheckOut(targetUserId: string) {
  const { data: existing } = await supabaseAdmin.from("attendance").select("id").eq("user_id", targetUserId).is("check_out", null).order("check_in", { ascending: false }).limit(1).maybeSingle();
  if (!existing) return { ok: false, message: "Active check-in পাওয়া যায়নি" };
  const { error } = await supabaseAdmin.from("attendance").update({ check_out: new Date().toISOString() }).eq("id", existing.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export const checkInAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid().optional() }).optional().parse(input)).handler(async ({ data, context }) => {
  const targetId = data?.user_id ?? context.userId;
  if (targetId !== context.userId && !(await isSuperAdminUser(context.userId))) throw new Error("Unauthorized");
  return doCheckIn(targetId);
});
export const checkOutAttendance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid().optional() }).optional().parse(input)).handler(async ({ data, context }) => {
  const targetId = data?.user_id ?? context.userId;
  if (targetId !== context.userId && !(await isSuperAdminUser(context.userId))) throw new Error("Unauthorized");
  return doCheckOut(targetId);
});
export const getEmployeeProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ user_id: z.string().uuid().optional() }).parse(input)).handler(async ({ data, context }) => {
  const targetId = data.user_id ?? context.userId;
  if (targetId !== context.userId && !(await isSuperAdminUser(context.userId))) throw new Error("Unauthorized");
  const since = new Date(); since.setDate(since.getDate() - 30);
  const [{ data: att }, { data: profile }, { data: emp }] = await Promise.all([
    supabaseAdmin.from("attendance").select("*").eq("user_id", targetId).gte("check_in", since.toISOString()).order("check_in", { ascending: false }),
    supabaseAdmin.from("profiles").select("*").eq("id", targetId).maybeSingle(),
    supabaseAdmin.from("employees").select("*").eq("user_id", targetId).maybeSingle(),
  ]);
  let total = 0, delivered = 0, cancelled = 0;
  try { const { data: orders } = await supabaseAdmin.from("orders").select("id,status,created_at").or(`assigned_to.eq.${targetId},created_by.eq.${targetId}`).gte("created_at", since.toISOString()); const ords = orders ?? []; total = ords.length; delivered = ords.filter((o) => o.status === "delivered").length; cancelled = ords.filter((o) => ["cancelled", "returned"].includes(o.status as string)).length; } catch {}
  let totalHours = 0, activeId: string | null = null;
  (att ?? []).forEach((a) => { if (!a.check_out) { activeId = a.id; return; } const ms = new Date(a.check_out).getTime() - new Date(a.check_in).getTime(); if (ms > 0) totalHours += ms / 3600000; });
  return { profile, employee: emp as any, attendance: att ?? [], activeAttendanceId: activeId, stats: { totalOrders: total, delivered, cancelled, score: Math.max(0, Math.min(100, delivered * 10 + (total - delivered - cancelled) * 2 - cancelled * 3)), totalHours: Math.round(totalHours * 10) / 10 } };
});

export const listAttendanceOverview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => z.object({ days: z.number().min(1).max(90).default(30) }).optional().parse(input)).handler(async ({ data, context }) => {
  if (!(await isAdminUser(context.userId))) throw new Error("Unauthorized");
  const days = data?.days ?? 30;
  const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0, 0, 0, 0);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const isSuperAdmin = await isSuperAdminUser(context.userId);
  const { data: emps } = isSuperAdmin
    ? await supabaseAdmin.from("employees").select("id,name,phone,email,position,user_id,is_active").eq("is_active", true).order("name")
    : await supabaseAdmin.from("employees").select("id,name,phone,email,position,user_id,is_active").eq("is_active", true).eq("user_id", context.userId).limit(1);
  const userIds = (emps ?? []).map((e) => e.user_id).filter(Boolean) as string[];
  const { data: attRows } = userIds.length ? await supabaseAdmin.from("attendance").select("id,user_id,check_in,check_out").in("user_id", userIds).gte("check_in", since.toISOString()).order("check_in", { ascending: false }) : { data: [] as Array<{ id: string; user_id: string; check_in: string; check_out: string | null }> };
  const list = (emps ?? []).map((e) => {
    const rows = (attRows ?? []).filter((r) => r.user_id === e.user_id);
    let totalHours = 0; const presentDates = new Set<string>(); let activeId: string | null = null; let todayCheckIn: string | null = null; let todayCheckOut: string | null = null;
    rows.forEach((r) => { const inT = new Date(r.check_in); const date = inT.toISOString().slice(0, 10); presentDates.add(date); if (!r.check_out) activeId = r.id; if (inT >= startOfToday) { if (!todayCheckIn || new Date(todayCheckIn) > inT) todayCheckIn = r.check_in; if (r.check_out && (!todayCheckOut || new Date(todayCheckOut) < new Date(r.check_out))) todayCheckOut = r.check_out; } if (r.check_out) { const ms = new Date(r.check_out).getTime() - inT.getTime(); if (ms > 0) totalHours += ms / 3600000; } });
    return { employee_id: e.id, user_id: e.user_id, name: e.name, phone: e.phone, email: e.email, position: e.position, activeAttendanceId: activeId, todayCheckIn, todayCheckOut, presentDays: presentDates.size, totalHours: Math.round(totalHours * 10) / 10, attendance: rows.map((r) => ({ id: r.id, date: new Date(r.check_in).toISOString().slice(0, 10), checkIn: r.check_in, checkOut: r.check_out })) };
  });
  return { days, employees: list };
});
