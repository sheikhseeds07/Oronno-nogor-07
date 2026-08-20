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

const norm = (value: number, max: number) => max > 0 ? value / max : 0;
const statusOf = (o: any) => String(o?.status ?? "").toLowerCase();
const isDelivered = (o: any) => statusOf(o) === "delivered";
const isReturned = (o: any) => ["returned", "rts", "pending_return"].includes(statusOf(o));
const isShipped = (o: any) => ["shipped", "delivered", "pending_return", "returned", "rts"].includes(statusOf(o));
const isCancelled = (o: any) => ["cancelled", "canceled"].includes(statusOf(o));

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

    const dashboardRows = Array.isArray((dashboard as any)?.employeePerformance) ? (dashboard as any).employeePerformance : [];
    const { data: employees, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id,name,user_id,is_active")
      .eq("is_active", true)
      .order("name");
    if (employeeError) throw new Error(employeeError.message);

    const employeeIds = (employees ?? []).map((e: any) => String(e.user_id ?? e.id)).filter(Boolean);
    const { data: roleRows, error: roleError } = employeeIds.length
      ? await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", employeeIds)
      : { data: [], error: null };
    if (roleError) throw new Error(roleError.message);
    const adminIds = new Set((roleRows ?? [])
      .filter((r: any) => ["admin", "super_admin"].includes(String(r.role).toLowerCase()))
      .map((r: any) => String(r.user_id)));

    const eligibleEmployees = (employees ?? []).filter((e: any) => {
      const id = String(e.user_id ?? e.id);
      return id && !adminIds.has(id);
    });
    const eligibleIds = new Set(eligibleEmployees.map((e: any) => String(e.user_id ?? e.id)));

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,status,created_at,updated_at,created_by,assigned_to")
      .gte("created_at", new Date(`${data.start}T00:00:00`).toISOString())
      .lte("created_at", new Date(`${data.end}T23:59:59.999`).toISOString())
      .limit(30000);
    if (ordersError) throw new Error(ordersError.message);

    const metrics = new Map<string, any>();
    for (const e of eligibleEmployees) {
      const id = String(e.user_id ?? e.id);
      metrics.set(id, {
        user_id: e.user_id ?? e.id,
        name: e.name,
        confirmed: 0,
        cancelled: 0,
        delivered: 0,
        returned: 0,
        shipped: 0,
        total: 0,
      });
    }

    // Confirmation/cancellation counts stay aligned with the Dashboard source of truth.
    for (const row of dashboardRows) {
      const id = String(row?.user_id ?? "");
      const m = metrics.get(id);
      if (!m) continue;
      m.confirmed = Number(row?.confirmed ?? 0);
      m.cancelled = Number(row?.cancelled ?? 0);
    }

    // Delivery/return/shipping are outcome metrics tied to the employee handling the order.
    for (const order of orders ?? []) {
      const id = String(order?.assigned_to ?? "");
      if (!eligibleIds.has(id)) continue;
      const m = metrics.get(id);
      if (!m) continue;
      if (isDelivered(order)) m.delivered++;
      if (isReturned(order)) m.returned++;
      if (isShipped(order)) m.shipped++;
    }

    for (const m of metrics.values()) m.total = m.confirmed + m.cancelled;

    const all = Array.from(metrics.values());
    const maxConfirmed = Math.max(0, ...all.map((m) => m.confirmed));
    const maxDelivered = Math.max(0, ...all.map((m) => m.delivered));
    const maxShipped = Math.max(0, ...all.map((m) => m.shipped));
    const maxCancelled = Math.max(0, ...all.map((m) => m.cancelled));
    const maxReturned = Math.max(0, ...all.map((m) => m.returned));

    // Overall score: successful outcomes carry the most weight; cancellations/returns reduce it.
    for (const m of all) {
      const positive =
        norm(m.confirmed, maxConfirmed) * 35 +
        norm(m.delivered, maxDelivered) * 35 +
        norm(m.shipped, maxShipped) * 10;
      const negative =
        norm(m.cancelled, maxCancelled) * 10 +
        norm(m.returned, maxReturned) * 10;
      m.score = Math.max(0, Math.min(100, Math.round(positive - negative)));
      const handled = m.confirmed + m.cancelled;
      m.handled = handled;
      m.confirmationRate = handled ? (m.confirmed / handled) * 100 : 0;
      m.cancellationRate = handled ? (m.cancelled / handled) * 100 : 0;
    }

    const leaderboard = all.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.delivered !== a.delivered) return b.delivered - a.delivered;
      if (b.confirmed !== a.confirmed) return b.confirmed - a.confirmed;
      if (a.cancelled !== b.cancelled) return a.cancelled - b.cancelled;
      if (a.returned !== b.returned) return a.returned - b.returned;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    const rankedIndex = leaderboard.findIndex((r) => String(r.user_id) === data.user_id);
    const row = rankedIndex >= 0 ? leaderboard[rankedIndex] : null;
    const confirmed = Number(row?.confirmed ?? 0);
    const cancelled = Number(row?.cancelled ?? 0);
    const delivered = Number(row?.delivered ?? 0);
    const returned = Number(row?.returned ?? 0);
    const shipped = Number(row?.shipped ?? 0);
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
      delivered,
      returned,
      shipped,
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