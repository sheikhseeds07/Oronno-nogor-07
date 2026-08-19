import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertStaff(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Unauthorized");
}

const RangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  statuses: z.array(z.string().max(40)).max(20).optional(),
});

/**
 * Status counts grouped by status, optionally restricted to a status set + date range.
 *
 * IMPORTANT: Do not fetch order rows and count them client/server-side. Supabase's
 * Data API row limit can cap the returned rows (commonly at 1000), which makes a
 * badge show an incorrect count even though the order list itself contains more.
 * Use exact HEAD counts per status so the badge is independent of pagination/API
 * row limits and always reflects the database count.
 */
export const getOrderStatusCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);

    const wanted = data.statuses?.length
      ? Array.from(new Set(data.statuses))
      : [
          "web_pending",
          "incomplete",
          "pending",
          "rts",
          "shipped",
          "delivered",
          "pending_return",
          "returned",
          "partial",
          "cancelled",
          "hold",
        ];

    const results = await Promise.all(
      wanted.map(async (status) => {
        let q = db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", status as any);
        if (data.from) q = q.gte("created_at", data.from);
        if (data.to) q = q.lte("created_at", data.to);
        const { count, error } = await q;
        if (error) throw new Error(error.message);
        return [status, count ?? 0] as const;
      }),
    );

    return Object.fromEntries(results) as Record<string, number>;
  });

/** Sales report — daily revenue + status breakdown for a date range. */
export const getSalesReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const from = data.from ?? new Date(Date.now() - 7 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();
    const { data: rows, error } = await db
      .from("orders")
      .select("id,status,total,created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .limit(10000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const totalOrders = list.length;
    let revenue = 0;
    let deliveredRevenue = 0;
    const statusCounts: Record<string, number> = {};
    const daily: Record<string, { date: string; orders: number; revenue: number }> = {};
    for (const o of list) {
      const t = Number(o.total) || 0;
      revenue += t;
      if (o.status === "delivered") deliveredRevenue += t;
      statusCounts[o.status as string] = (statusCounts[o.status as string] ?? 0) + 1;
      const d = (o.created_at ?? "").slice(0, 10);
      if (!daily[d]) daily[d] = { date: d, orders: 0, revenue: 0 };
      daily[d].orders += 1;
      daily[d].revenue += t;
    }
    return {
      totalOrders,
      revenue,
      deliveredRevenue,
      delivered: statusCounts.delivered ?? 0,
      cancelled: (statusCounts.cancelled ?? 0) + (statusCounts.returned ?? 0),
      pending: statusCounts.pending ?? 0,
      statusCounts,
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

/** Employee report — per-employee order stats in a date range. */
export const getEmployeeReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const from = data.from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();
    const [{ data: orders, error: ordersError }, { data: emps, error: empsError }, { data: profiles, error: profilesError }] = await Promise.all([
      db
        .from("orders")
        .select("id,status,total,created_at")
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(20000),
      db.from("employees").select("user_id,name,email"),
      db.from("profiles").select("id,full_name"),
    ]);
    const firstError = ordersError ?? empsError ?? profilesError;
    if (firstError) throw new Error(firstError.message);

    type Row = {
      userId: string;
      name: string;
      total: number;
      confirmed: number;
      delivered: number;
      cancelled: number;
      revenue: number;
      deliveredRevenue: number;
    };
    const map = new Map<string, Row>();
    for (const o of orders ?? []) {
      const uid = "unassigned";
      if (!uid) continue;
      let r = map.get(uid);
      if (!r) {
        r = { userId: uid, name: "Unassigned / Web", total: 0, confirmed: 0, delivered: 0, cancelled: 0, revenue: 0, deliveredRevenue: 0 };
        map.set(uid, r);
      }
      const t = Number(o.total) || 0;
      r.total += 1;
      r.revenue += t;
      if (o.status !== "web_pending") r.confirmed += 1;
      if (o.status === "delivered") { r.delivered += 1; r.deliveredRevenue += t; }
      if (o.status === "cancelled" || o.status === "returned") r.cancelled += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.delivered - a.delivered);
  });

/**
 * Daily funnel for incomplete carts and web orders.
 * Cancellation counts come from append-only history so deleting a cancelled
 * Web Order or Incomplete Order never rolls the Dashboard statistic back.
 */
export const getFunnelReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const db = context.supabase;
    const from = data.from ?? new Date(Date.now() - 7 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();

    const [evRes, webRes, cancelRes] = await Promise.all([
      db.from("incomplete_events").select("event,created_at").gte("created_at", from).lte("created_at", to),
      db.from("orders").select("status,created_at,updated_at").eq("source", "web").or(`and(created_at.gte.${from},created_at.lte.${to}),and(updated_at.gte.${from},updated_at.lte.${to})`),
      db.from("order_cancellation_history").select("source,cancelled_at").gte("cancelled_at", from).lte("cancelled_at", to),
    ]);

    const dayKey = (iso: string) => iso.slice(0, 10);
    const map = new Map<string, {
      date: string;
      totalIncomplete: number; cancelled: number; converted: number;
      totalWeb: number; webCancelled: number; webProcessed: number;
    }>();
    const ensure = (d: string) => {
      let r = map.get(d);
      if (!r) {
        r = { date: d, totalIncomplete: 0, cancelled: 0, converted: 0, totalWeb: 0, webCancelled: 0, webProcessed: 0 };
        map.set(d, r);
      }
      return r;
    };

    for (const e of evRes.data ?? []) {
      const r = ensure(dayKey(e.created_at as string));
      if (e.event === "created") r.totalIncomplete += 1;
      else if (e.event === "cancelled") r.cancelled += 1;
      else if (e.event === "converted") r.converted += 1;
    }

    // Cancellation is historical and append-only. It is intentionally not
    // derived from the current orders table, because cancelled orders may be deleted.
    for (const c of cancelRes.data ?? []) {
      const d = dayKey(c.cancelled_at as string);
      const r = ensure(d);
      if (c.source === "incomplete") r.cancelled += 1;
      else r.webCancelled += 1;
    }

    const processingWebStatuses = new Set([
      "web_pending",
      "rts",
      "shipped",
      "delivered",
      "pending_return",
      "returned",
      "partial",
    ]);

    for (const o of webRes.data ?? []) {
      const createdDay = dayKey(o.created_at as string);
      const createdInRange = (o.created_at as string) >= from && (o.created_at as string) <= to;
      if (createdInRange) ensure(createdDay).totalWeb += 1;

      const updDay = dayKey((o.updated_at as string) ?? createdDay);
      const updInRange = (o.updated_at as string) >= from && (o.updated_at as string) <= to;
      if (processingWebStatuses.has(o.status as string) && updInRange) {
        ensure(updDay).webProcessed += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  });
