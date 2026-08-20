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

const CONFIRMED = new Set(["pending", "rts", "shipped", "delivered", "pending_return", "returned", "partial"]);
const isConfirmed = (status: unknown) => CONFIRMED.has(String(status ?? "").toLowerCase());
const isCancelled = (status: unknown) => ["cancelled", "canceled"].includes(String(status ?? "").toLowerCase());

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

    // The Dashboard is the single source of truth for employee confirmation metrics.
    // Keep the same employee population and actor/status rules here so Profile and
    // Dashboard can never show different confirmation/cancellation numbers.
    const adminIds = new Set((roles ?? []).map((r) => r.user_id).filter(Boolean));
    const employeeRows = (employees ?? []).filter((e) => e.user_id && !adminIds.has(e.user_id));
    const userIds = employeeRows.map((e) => e.user_id).filter(Boolean) as string[];

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,status,source,created_at,updated_at,created_by,assigned_to")
      .gte("created_at", start)
      .lte("created_at", end)
      .limit(30000);
    if (ordersError) throw new Error(ordersError.message);

    const stats = new Map<string, { confirmed: number; cancelled: number; handled: number; hours: number; present: number; streak: number }>();
    for (const id of userIds) stats.set(id, { confirmed: 0, cancelled: 0, handled: 0, hours: 0, present: 0, streak: 0 });

    // EXACT Dashboard actor logic:
    // - confirmed order -> created_by employee
    // - cancelled order -> assigned_to employee
    // - no assigned_to fallback for confirmations
    // - no web_pending/processing confirmation; only Dashboard's CONFIRMED set
    // - incomplete orders are included because Dashboard's employee section uses all orders
    for (const o of orders ?? []) {
      const status = String(o.status ?? "").toLowerCase();
      if (isConfirmed(status)) {
        const uid = String(o.created_by ?? "");
        const s = stats.get(uid);
        if (s) {
          s.confirmed++;
          s.handled++;
        }
      } else if (isCancelled(status)) {
        const uid = String(o.assigned_to ?? "");
        const s = stats.get(uid);
        if (s) {
          s.cancelled++;
          s.handled++;
        }
      }
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

    // Ranking uses the same real confirmation/cancellation counts, with attendance
    // as the only additional factor for the profile score.
    const scored = userIds.map((id) => {
      const s = stats.get(id)!;
      const decisions = s.confirmed + s.cancelled;
      const confirmationRate = decisions ? (s.confirmed / decisions) * 100 : 0;
      const cancellationRate = decisions ? (s.cancelled / decisions) * 100 : 0;
      const attendanceScore = Math.min(100, (s.present / 26) * 100);
      return { id, score: Math.max(0, Math.min(100, Math.round(confirmationRate * 0.65 + (100 - cancellationRate) * 0.2 + attendanceScore * 0.15))) };
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const rankIndex = scored.findIndex((x) => x.id === data.user_id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 0;
    const me = stats.get(data.user_id) ?? { confirmed: 0, cancelled: 0, handled: 0, hours: 0, present: 0, streak: 0 };
    const employee: any = employeeRows.find((e) => e.user_id === data.user_id) ?? {};
    const decisions = me.confirmed + me.cancelled;
    const confirmationRate = decisions ? Math.round((me.confirmed / decisions) * 100) : 0;
    const cancellationRate = decisions ? Math.round((me.cancelled / decisions) * 100) : 0;
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
