import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { getPremiumDashboardReport } from "@/lib/dashboard.functions";

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

    const dashboard = await getPremiumDashboardReport({
      data: {
        from: new Date(`${data.start}T00:00:00`).toISOString(),
        to: new Date(`${data.end}T23:59:59.999`).toISOString(),
      },
      context: context as any,
    } as any);

    const rows = Array.isArray((dashboard as any)?.employeePerformance) ? (dashboard as any).employeePerformance : [];

    // Build the monthly leaderboard from the same Dashboard source of truth.
    // Admin/super-admin are never part of employeesR, so they cannot take a rank.
    const leaderboard = rows.map((r: any) => {
      const confirmed = Number(r?.confirmed ?? 0);
      const cancelled = Number(r?.cancelled ?? 0);
      const handled = confirmed + cancelled;
      const confirmationRate = handled ? (confirmed / handled) * 100 : 0;
      const cancellationRate = handled ? (cancelled / handled) * 100 : 0;
      const score = handled ? Math.max(0, Math.min(100, Math.round(confirmationRate * 0.8 + (100 - cancellationRate) * 0.2))) : 0;
      return { ...r, confirmed, cancelled, handled, confirmationRate, cancellationRate, score };
    }).filter((r: any) => r.user_id).sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.confirmed !== a.confirmed) return b.confirmed - a.confirmed;
      if (a.cancelled !== b.cancelled) return a.cancelled - b.cancelled;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    const rankedIndex = leaderboard.findIndex((r: any) => String(r.user_id) === data.user_id);
    const row = rankedIndex >= 0 ? leaderboard[rankedIndex] : null;
    const confirmed = Number(row?.confirmed ?? 0);
    const cancelled = Number(row?.cancelled ?? 0);
    const handled = confirmed + cancelled;

    const [{ data: attendance }, { data: employee }] = await Promise.all([
      supabaseAdmin.from("attendance").select("id,user_id,check_in,check_out").eq("user_id", data.user_id).gte("check_in", new Date(`${data.start}T00:00:00`).toISOString()).lte("check_in", new Date(`${data.end}T23:59:59.999`).toISOString()).order("check_in", { ascending: false }),
      supabaseAdmin.from("employees").select("*").eq("user_id", data.user_id).maybeSingle(),
    ]);

    const attendanceRows = attendance ?? [];
    const presentDays = new Set(attendanceRows.map((r) => new Date(r.check_in).toISOString().slice(0, 10))).size;
    let hours = 0;
    for (const a of attendanceRows) {
      const out = a.check_out ? new Date(a.check_out).getTime() : Date.now();
      const ms = out - new Date(a.check_in).getTime();
      if (ms > 0) hours += ms / 3600000;
    }

    const confirmationRate = handled ? Math.round((confirmed / handled) * 100) : 0;
    const cancellationRate = handled ? Math.round((cancelled / handled) * 100) : 0;
    const score = Number(row?.score ?? 0);
    const level = score >= 90 ? "Elite" : score >= 80 ? "Gold" : score >= 65 ? "Silver" : "Bronze";

    return {
      confirmed,
      cancelled,
      totalOrders: handled,
      confirmationRate,
      cancellationRate,
      totalHours: Math.round(hours * 10) / 10,
      avgHours: presentDays ? Math.round((hours / presentDays) * 10) / 10 : 0,
      presentDays,
      streak: streakDays(attendanceRows),
      score,
      rank: rankedIndex >= 0 ? rankedIndex + 1 : 0,
      teamSize: leaderboard.length,
      isBest: rankedIndex === 0 && leaderboard.length > 0,
      bestPerformer: leaderboard[0]?.name ?? null,
      level,
      monthlyBonus: Number(employee?.monthly_bonus ?? 0),
      leaveBalance: Number(employee?.leave_balance ?? 0),
      target: Number(employee?.monthly_target ?? employee?.daily_target ?? 0),
      achievements: Array.isArray(employee?.achievements) ? employee.achievements : [],
      adminNotes: String(employee?.admin_notes ?? ""),
      attendance: attendanceRows,
    };
  });
