import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  return !!data?.length;
}

function streakDays(rows: Array<{ check_in: string }>) {
  const days = new Set(rows.map((r) => new Date(r.check_in).toISOString().slice(0, 10)));
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

export const getEmployeePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), start: z.string(), end: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId && !(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const start = new Date(`${data.start}T00:00:00`).toISOString();
    const end = new Date(`${data.end}T23:59:59.999`).toISOString();

    const [{ data: attendance }, { data: employees }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("attendance").select("id,user_id,check_in,check_out").gte("check_in", start).lte("check_in", end).order("check_in", { ascending: false }),
      supabaseAdmin.from("employees").select("*").eq("is_active", true),
      supabaseAdmin.from("user_roles").select("user_id,role").in("role", ["admin", "super_admin"]),
    ]);

    // Admins/owners are never part of employee performance ranking.
    const adminIds = new Set((roles ?? []).map((r) => r.user_id).filter(Boolean));
    const employeeRows = (employees ?? []).filter((e) => e.user_id && !adminIds.has(e.user_id));
    const userIds = employeeRows.map((e) => e.user_id).filter(Boolean) as string[];

    let orders: any[] = [];
    try {
      const { data: rows, error } = await supabaseAdmin
        .from("orders")
        .select("id,status,source,created_at,assigned_to")
        .not("assigned_to", "is", null)
        .gte("created_at", start)
        .lte("created_at", end)
        .limit(20000);
      if (!error) orders = rows ?? [];
    } catch {}

    const stats = new Map<string, { confirmed: number; cancelled: number; handled: number; hours: number; present: number; streak: number }>();
    for (const id of userIds) stats.set(id, { confirmed: 0, cancelled: 0, handled: 0, hours: 0, present: 0, streak: 0 });

    // Only orders actually assigned to the employee count. web_pending means the order
    // is still waiting for confirmation, so it is not counted as confirmed/handled yet.
    for (const o of orders) {
      const uid = String(o.assigned_to ?? "");
      const s = stats.get(uid);
      if (!s) continue;
      const status = String(o.status ?? "").toLowerCase();
      if (status === "web_pending") continue;
      s.handled++;
      if (["cancelled", "canceled", "returned"].includes(status)) s.cancelled++;
      else s.confirmed++;
    }

    for (const id of userIds) {
      const rows = (attendance ?? []).filter((a) => a.user_id === id);
      const s = stats.get(id)!;
      s.present = new Set(rows.map((r) => new Date(r.check_in).toISOString().slice(0, 10))).size;
      s.streak = streakDays(rows);
      for (const a of rows) {
        const out = a.check_out ? new Date(a.check_out).getTime() : Date.now();
        const ms = out - new Date(a.check_in).getTime();
        if (ms > 0) s.hours += ms / 3600000;
      }
    }

    const scored = userIds.map((id) => {
      const s = stats.get(id)!;
      const rate = s.handled ? (s.confirmed / s.handled) * 100 : 0;
      const cancelRate = s.handled ? (s.cancelled / s.handled) * 100 : 0;
      const attendanceScore = Math.min(100, (s.present / 26) * 100);
      return { id, score: Math.max(0, Math.min(100, Math.round(rate * 0.65 + (100 - cancelRate) * 0.2 + attendanceScore * 0.15))) };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const rankIndex = scored.findIndex((x) => x.id === data.user_id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 0;
    const me = stats.get(data.user_id) ?? { confirmed: 0, cancelled: 0, handled: 0, hours: 0, present: 0, streak: 0 };
    const employee: any = employeeRows.find((e) => e.user_id === data.user_id) ?? {};
    const confirmationRate = me.handled ? Math.round((me.confirmed / me.handled) * 100) : 0;
    const cancellationRate = me.handled ? Math.round((me.cancelled / me.handled) * 100) : 0;
    const score = rankIndex >= 0 ? scored[rankIndex].score : 0;
    const level = score >= 90 ? "Elite" : score >= 80 ? "Gold" : score >= 65 ? "Silver" : "Bronze";

    return {
      confirmed: me.confirmed,
      cancelled: me.cancelled,
      totalOrders: me.handled,
      confirmationRate,
      cancellationRate,
      totalHours: Math.round(me.hours * 10) / 10,
      avgHours: me.present ? Math.round((me.hours / me.present) * 10) / 10 : 0,
      presentDays: me.present,
      streak: me.streak,
      score,
      rank,
      teamSize: userIds.length,
      level,
      monthlyBonus: Number(employee.monthly_bonus ?? 0),
      leaveBalance: Number(employee.leave_balance ?? 0),
      target: Number(employee.monthly_target ?? employee.daily_target ?? 0),
      achievements: Array.isArray(employee.achievements) ? employee.achievements : [],
      adminNotes: String(employee.admin_notes ?? ""),
      attendance: (attendance ?? []).filter((a) => a.user_id === data.user_id),
    };
  });
