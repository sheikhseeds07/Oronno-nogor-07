import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const empty = { total: 0, confirmed: 0, processing: 0, cancelled: 0 };

type MetaProfitConfig = {
  access_token?: string;
  ad_account_id?: string;
  account_name?: string;
  dollar_rate?: number | string;
  courier_cost_per_order?: number | string;
  return_rate?: number | string;
  cancel_rate?: number | string;
};

const bdDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));

async function getMetaProfitData(from: string, to: string) {
  const defaults = {
    dollarRate: 122,
    courierCostPerOrder: 50,
    cancelRate: 20,
    adSpendUsd: 0,
    adSpendBdt: 0,
    connected: false,
    accountName: "",
    error: null as string | null,
  };

  const db = supabaseAdmin as any;
  const { data: integration, error } = await db
    .from("integrations")
    .select("config,is_active")
    .eq("name", "meta_ad_account")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const cfg = (integration?.config ?? {}) as MetaProfitConfig;
  const dollarRate = Math.max(0, Number(cfg.dollar_rate) || defaults.dollarRate);
  const courierCostPerOrder = Math.max(0, Number(cfg.courier_cost_per_order) || defaults.courierCostPerOrder);
  const cancelRate = Math.min(100, Math.max(0, Number(cfg.cancel_rate ?? cfg.return_rate) || defaults.cancelRate));
  const accountName = String(cfg.account_name ?? "Meta Ad Account");

  if (!integration?.is_active || !cfg.access_token || !cfg.ad_account_id) {
    return { ...defaults, dollarRate, courierCostPerOrder, cancelRate, accountName };
  }

  try {
    const accountId = String(cfg.ad_account_id).replace(/^act_/, "");
    const base = `https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}`;
    const timeRange = encodeURIComponent(JSON.stringify({ since: bdDay(from), until: bdDay(to) }));
    const auth = `access_token=${encodeURIComponent(String(cfg.access_token).trim())}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(`${base}/insights?fields=spend&time_range=${timeRange}&level=account&${auth}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    const json = await response.json();
    if (!response.ok || json?.error) throw new Error(json?.error?.message || "Meta spend request failed");
    const adSpendUsd = Number(json?.data?.[0]?.spend || 0);
    return {
      dollarRate,
      courierCostPerOrder,
      cancelRate,
      adSpendUsd,
      adSpendBdt: adSpendUsd * dollarRate,
      connected: true,
      accountName,
      error: null as string | null,
    };
  } catch (e) {
    return {
      dollarRate,
      courierCostPerOrder,
      cancelRate,
      adSpendUsd: 0,
      adSpendBdt: 0,
      connected: true,
      accountName,
      error: e instanceof Error ? e.message : "Meta spend unavailable",
    };
  }
}

/**
 * Rebuild cancellation attribution from the persistent cancellation log.
 * The dashboard RPC can lag behind the live schema, so the dashboard reads
 * this append-only history directly and keeps confirmation numbers untouched.
 */
async function getLiveEmployeeCancellationPerformance(from: string, to: string, baseRows: any[]) {
  const db = supabaseAdmin as any;

  const [employeesR, divisionMembersR, cancelEventsR, confirmEventsR] = await Promise.all([
    db.from("employees").select("user_id,name").eq("is_active", true),
    db.from("order_distribution_members").select("user_id,enabled").eq("enabled", true),
    db.from("order_action_events")
      .select("order_id,actor_id,action,created_at")
      .eq("action", "cancel")
      .gte("created_at", from)
      .lte("created_at", to),
    db.from("order_action_events")
      .select("order_id,actor_id,action,created_at")
      .eq("action", "confirm")
      .gte("created_at", from)
      .lte("created_at", to),
  ]);

  if (employeesR.error) throw new Error(employeesR.error.message);
  if (divisionMembersR.error) throw new Error(divisionMembersR.error.message);
  if (cancelEventsR.error) throw new Error(cancelEventsR.error.message);
  if (confirmEventsR.error) throw new Error(confirmEventsR.error.message);

  const cancelEvents = cancelEventsR.data ?? [];
  const confirmEvents = confirmEventsR.data ?? [];
  const allIds = Array.from(new Set(
    [...cancelEvents, ...confirmEvents]
      .map((e: any) => String(e?.order_id ?? ""))
      .filter(Boolean)
  ));

  const [ordersR, deletedR, cancelHistoryR] = await Promise.all([
    allIds.length
      ? db.from("orders").select("id,source,created_by,confirmed_by,assigned_to").in("id", allIds)
      : Promise.resolve({ data: [], error: null }),
    allIds.length
      ? db.from("deleted_orders").select("id,order_data").in("id", allIds)
      : Promise.resolve({ data: [], error: null }),
    allIds.length
      ? db.from("order_cancellation_history")
          .select("order_id,source,cancelled_at")
          .in("order_id", allIds)
          .gte("cancelled_at", from)
          .lte("cancelled_at", to)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ordersR.error) throw new Error(ordersR.error.message);
  if (deletedR.error) throw new Error(deletedR.error.message);
  if (cancelHistoryR.error) throw new Error(cancelHistoryR.error.message);

  const sourceByOrder = new Map<string, string>();
  for (const row of ordersR.data ?? []) {
    sourceByOrder.set(String(row.id), String(row.source ?? "").toLowerCase());
  }
  for (const row of deletedR.data ?? []) {
    if (!sourceByOrder.has(String(row.id))) {
      const data = row?.order_data && typeof row.order_data === "object" ? row.order_data : {};
      sourceByOrder.set(String(row.id), String(data?.source ?? "").toLowerCase());
    }
  }

  const orderDivisionActiveIds = new Set((divisionMembersR.data ?? []).map((row: any) => String(row?.user_id ?? "")).filter(Boolean));

  const rows = new Map<string, any>();
  for (const row of baseRows) {
    const id = String(row?.user_id ?? "");
    if (!id) continue;
    rows.set(id, {
      ...row,
      // These are rebuilt from the append-only action events below.
      confirmed: 0,
      web_confirmed: 0,
      incomplete_confirmed: 0,
      cancelled: 0,
      incomplete_cancelled: 0,
      total: Number(row?.total ?? 0),
      order_division_active: orderDivisionActiveIds.has(id),
    });
  }
  for (const employee of employeesR.data ?? []) {
    const id = String(employee?.user_id ?? "");
    if (!id) continue;
    if (!rows.has(id)) {
      rows.set(id, {
        user_id: id,
        name: employee?.name ?? "Unknown",
        confirmed: 0,
        web_confirmed: 0,
        incomplete_confirmed: 0,
        cancelled: 0,
        incomplete_cancelled: 0,
        total: 0,
        order_division_active: orderDivisionActiveIds.has(id),
      });
    }
  }

  // Confirmation attribution is based on the actual confirmation event actor
  // and the order's persisted source. Therefore Web and Incomplete can never
  // be mixed together.
  for (const event of confirmEvents) {
    const actor = String(event?.actor_id ?? "");
    const orderId = String(event?.order_id ?? "");
    if (!actor || !orderId) continue;
    const target = rows.get(actor);
    if (!target) continue;

    const source = sourceByOrder.get(orderId);
    if (source === "incomplete") target.incomplete_confirmed += 1;
    else if (source === "web") target.web_confirmed += 1;
  }

  for (const target of rows.values()) {
    target.confirmed = Number(target.web_confirmed ?? 0) + Number(target.incomplete_confirmed ?? 0);
  }

  // Cancellation attribution uses the cancellation event actor, while the
  // source is read from the persistent order/cancellation record.
  const cancelSourceByOrder = new Map<string, string>();
  for (const row of cancelHistoryR.data ?? []) {
    cancelSourceByOrder.set(String(row.order_id), String(row.source ?? "").toLowerCase());
  }

  for (const event of cancelEvents) {
    const actor = String(event?.actor_id ?? "");
    const orderId = String(event?.order_id ?? "");
    if (!actor || !orderId) continue;
    const target = rows.get(actor);
    if (!target) continue;

    const source = cancelSourceByOrder.get(orderId) ?? sourceByOrder.get(orderId) ?? "";
    if (source === "incomplete") target.incomplete_cancelled += 1;
    else if (source === "web") target.cancelled += 1;
  }

  return Array.from(rows.values()).sort((a, b) => {
    const confirmedDiff = Number(b.confirmed ?? 0) - Number(a.confirmed ?? 0);
    if (confirmedDiff) return confirmedDiff;
    return (Number(b.cancelled ?? 0) + Number(b.incomplete_cancelled ?? 0)) -
      (Number(a.cancelled ?? 0) + Number(a.incomplete_cancelled ?? 0));
  });
}
const EmployeeMetricSchema = z.object({
  userId: z.string().uuid(),
  metric: z.enum(["web_confirm", "incomplete_confirm", "web_cancel", "incomplete_cancel"]),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const EmployeeMetricStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(["web_pending", "pending", "rts", "shipped", "delivered", "pending_return", "returned", "partial", "cancelled", "hold"]),
});

export const getEmployeeMetricOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EmployeeMetricSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin", "employee"])
      .limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const db = supabaseAdmin as any;
    const action = data.metric === "web_confirm" || data.metric === "incomplete_confirm" ? "confirm" : "cancel";
    const { data: events, error: eventsError } = await db
      .from("order_action_events")
      .select("order_id,actor_id,action,created_at")
      .eq("actor_id", data.userId)
      .eq("action", action)
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .order("created_at", { ascending: false });
    if (eventsError) throw new Error(eventsError.message);

    const eventIds = Array.from(new Set((events ?? []).map((e: any) => String(e.order_id ?? "")).filter(Boolean)));
    if (!eventIds.length) return [];

    const history = data.metric === "web_cancel" || data.metric === "incomplete_cancel" ? await db
      .from("order_cancellation_history")
      .select("order_id,source,cancelled_at")
      .in("order_id", eventIds)
      .gte("cancelled_at", data.from)
      .lte("cancelled_at", data.to) : { data: [], error: null };
    if (history.error) throw new Error(history.error.message);

    const sourceByOrder = new Map<string, string>((history.data ?? []).map((h: any) => [String(h.order_id), String(h.source ?? "").toLowerCase()]));
    const ids = data.metric === "web_cancel" || data.metric === "incomplete_cancel"
      ? eventIds.filter((id) => sourceByOrder.get(id) === (data.metric === "incomplete_cancel" ? "incomplete" : "web"))
      : eventIds;

    if (!ids.length) return [];

    const [ordersR, deletedR] = await Promise.all([
      db.from("orders")
        .select("id,source,invoice_no,customer_name,customer_phone,total,status,created_at,updated_at")
        .in("id", ids),
      db.from("deleted_orders")
        .select("id,order_data,invoice_no,customer_name,customer_phone,total,original_status,original_created_at,deleted_at")
        .in("id", ids),
    ]);
    if (ordersR.error) throw new Error(ordersR.error.message);
    if (deletedR.error) throw new Error(deletedR.error.message);

    const byId = new Map<string, any>();
    for (const o of ordersR.data ?? []) byId.set(String(o.id), { ...o, archived: false });
    for (const o of deletedR.data ?? []) {
      if (!byId.has(String(o.id))) {
        byId.set(String(o.id), {
          id: o.id,
          invoice_no: o.invoice_no,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          total: o.total,
          status: o.original_status,
          created_at: o.original_created_at,
          updated_at: o.deleted_at,
          archived: true,
        });
      }
    }

    const filteredIds = (data.metric === "web_confirm" || data.metric === "incomplete_confirm")
      ? eventIds.filter((id) => {
          const live = (ordersR.data ?? []).find((o: any) => String(o.id) === id);
          const archived = (deletedR.data ?? []).find((o: any) => String(o.id) === id);
          const source = String(live?.source ?? archived?.order_data?.source ?? "").toLowerCase();
          return source === (data.metric === "incomplete_confirm" ? "incomplete" : "web");
        })
      : ids;

    return eventIds
      .filter((id) => filteredIds.includes(id))
      .map((id) => byId.get(id))
      .filter(Boolean);
  });

export const bulkUpdateEmployeeMetricOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EmployeeMetricStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin", "employee"])
      .limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const db = supabaseAdmin as any;
    const { data: existing, error: existingError } = await db
      .from("orders")
      .select("id")
      .in("id", data.orderIds);
    if (existingError) throw new Error(existingError.message);

    const existingIds = new Set((existing ?? []).map((o: any) => String(o.id)));
    const archivedIds = data.orderIds.filter((id) => !existingIds.has(id));

    if (archivedIds.length) {
      for (const id of archivedIds) {
        const { error } = await db.rpc("restore_deleted_order", { p_id: id, p_status: data.status });
        if (error) throw new Error(error.message);
      }
    }

    const liveIds = data.orderIds.filter((id) => existingIds.has(id));
    if (liveIds.length) {
      const { error } = await db.from("orders").update({ status: data.status, updated_at: new Date().toISOString() }).in("id", liveIds);
      if (error) throw new Error(error.message);
    }

    return { updated: data.orderIds.length };
  });

export const getWebProcessingOrderCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin", "employee"])
      .limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "web_pending");
    if (error) throw new Error(error.message);
    return Number(count ?? 0);
  });

export const getOptimizedDashboardReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "super_admin", "employee"]).limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const db = supabaseAdmin as any;
    const [{ data: summary, error }, confirmedCountR, metaProfit] = await Promise.all([
      db.rpc("dashboard_egress_summary", { p_from: data.from, p_to: data.to }),
      db.rpc("dashboard_confirmed_order_count", { p_from: data.from, p_to: data.to }),
      getMetaProfitData(data.from, data.to),
    ]);
    if (error) throw new Error(error.message);
    if (confirmedCountR.error) throw new Error(confirmedCountR.error.message);

    const s: any = summary ?? {};
    const real = s.real ?? { ...empty, created: 0, revenue: 0, allRevenue: 0, approved: 0, pending: 0 };
    const web = s.webOrders ?? empty;
    const incomplete = s.incompleteOrders ?? { ...empty, active: 0 };
    const daily = Array.isArray(s.daily) ? s.daily : [];
    const hourlyRaw = Array.isArray(s.hourly) ? s.hourly : [];
    const bestSelling = Array.isArray(s.bestSelling) ? s.bestSelling : [];
    const sourceBreakdown = Array.isArray(s.sourceBreakdown) ? s.sourceBreakdown : [];
    let employeePerformance = Array.isArray(s.employeePerformance) ? s.employeePerformance : [];

    // Employee analytics is supplementary: never block the whole dashboard if
    // its audit/history tables are temporarily unavailable.
    try {
      employeePerformance = await getLiveEmployeeCancellationPerformance(data.from, data.to, employeePerformance);
    } catch {
      // Keep the RPC-provided employee data so the rest of the dashboard still loads.
    }

    const [productsR, customersR, todayVisitorsR] = await Promise.all([
      supabaseAdmin.from("products").select("id,name,stock,is_active,cost").eq("is_active", true).order("stock", { ascending: true }).limit(100),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("site_visitors")
        .select("id", { count: "exact", head: true })
        .gte("last_seen", new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) + "T00:00:00+06:00").toISOString())
        .or("path.eq./,path.like./landing/*"),
    ]);
    // These cards are independent from the sales report. A temporary failure
    // in one auxiliary table must not blank the entire dashboard.
    const products = productsR.error ? [] : (productsR.data ?? []);
    const lowStock = products.filter((p: any) => Number(p.stock ?? 0) <= 5).slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
    const stockSummary = {
      total: products.length,
      low: products.filter((p: any) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= 5).length,
      out: products.filter((p: any) => Number(p.stock ?? 0) <= 0).length,
    };
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`,
      orders: 0,
    }));
    for (const d of hourlyRaw) {
      const hour = Number(d.hour);
      if (hour >= 0 && hour < 24) hourly[hour].orders = Number(d.orders ?? 0);
    }

    const grossSales = Number(s.profit?.grossSales ?? real.revenue ?? 0);
    const productCost = Number(s.profit?.productCost ?? 0);
    const confirmedOrders = Number(confirmedCountR.data ?? real.approved ?? real.confirmed ?? 0);
    const courierCost = confirmedOrders * metaProfit.courierCostPerOrder;
    const cancellationAdjustment = grossSales * (metaProfit.cancelRate / 100);
    const netProfit = grossSales - productCost - metaProfit.adSpendBdt - courierCost - cancellationAdjustment;
    const netProfitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

    return {
      real: { ...real, total: Number(real.total ?? real.created ?? 0), approved: confirmedOrders },
      webOrders: web,
      incompleteOrders: incomplete,
      profit: {
        grossSales,
        productCost,
        adSpendUsd: metaProfit.adSpendUsd,
        adSpendBdt: metaProfit.adSpendBdt,
        dollarRate: metaProfit.dollarRate,
        confirmedOrders,
        courierCost,
        courierCostPerOrder: metaProfit.courierCostPerOrder,
        cancelRate: metaProfit.cancelRate,
        cancellationAdjustment,
        netProfit,
        netProfitMargin,
        connected: metaProfit.connected,
        accountName: metaProfit.accountName,
        error: metaProfit.error,
      },
      sourceBreakdown,
      daily,
      hourly,
      earnings: [],
      bestSelling,
      lowStock,
      stockSummary,
      todayVisitors: Number(todayVisitorsR.error ? 0 : todayVisitorsR.count ?? 0),
      employeePerformance,
      customerCount: Number(customersR.error ? 0 : customersR.count ?? 0),
    };
  });
