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
    const response = await fetch(`${base}/insights?fields=spend&time_range=${timeRange}&level=account&${auth}`);
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
  const [historyR, employeesR] = await Promise.all([
    db
      .from("order_cancellation_history")
      .select("order_id,source,cancelled_at")
      .gte("cancelled_at", from)
      .lte("cancelled_at", to),
    db
      .from("employees")
      .select("user_id,name")
      .eq("is_active", true),
  ]);
  if (historyR.error) throw new Error(historyR.error.message);
  if (employeesR.error) throw new Error(employeesR.error.message);

  const history = historyR.data ?? [];
  if (!history.length) return baseRows;

  const ids = Array.from(new Set(history.map((row: any) => String(row.order_id ?? "")).filter(Boolean)));
  const [ordersR, deletedR] = await Promise.all([
    ids.length
      ? db.from("orders").select("id,created_by,confirmed_by").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? db.from("deleted_orders").select("id,order_data").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ordersR.error) throw new Error(ordersR.error.message);
  if (deletedR.error) throw new Error(deletedR.error.message);

  const actorByOrder = new Map<string, string>();
  for (const row of ordersR.data ?? []) {
    // Incomplete cancellations belong to the employee currently assigned to
    // the incomplete order. Web cancellations keep confirmed_by/created_by.
    const historyRow = history.find((h: any) => String(h?.order_id ?? "") === String(row?.id ?? ""));
    const actor = String(historyRow?.source ?? "").toLowerCase() === "incomplete"
      ? row?.assigned_to
      : (row?.confirmed_by ?? row?.created_by);
    if (actor) actorByOrder.set(String(row.id), String(actor));
  }
  for (const row of deletedR.data ?? []) {
    if (actorByOrder.has(String(row.id))) continue;
    const raw = row?.order_data;
    const data = raw && typeof raw === "object" ? raw : {};
    const actor = data?.confirmed_by ?? data?.created_by;
    if (actor) actorByOrder.set(String(row.id), String(actor));
  }

  const rows = new Map<string, any>();
  for (const row of baseRows) {
    const id = String(row?.user_id ?? "");
    if (!id) continue;
    rows.set(id, {
      ...row,
      cancelled: 0,
      incomplete_cancelled: 0,
      total: Number(row?.total ?? 0),
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
        cancelled: 0,
        incomplete_cancelled: 0,
        total: 0,
      });
    }
  }

  for (const row of history) {
    const actor = actorByOrder.get(String(row?.order_id ?? ""));
    if (!actor) continue;
    const target = rows.get(actor);
    if (!target) continue;
    const source = String(row?.source ?? "").toLowerCase();
    if (source === "incomplete") target.incomplete_cancelled += 1;
    else target.cancelled += 1;
  }

  return Array.from(rows.values()).sort((a, b) => {
    const confirmedDiff = Number(b.confirmed ?? 0) - Number(a.confirmed ?? 0);
    if (confirmedDiff) return confirmedDiff;
    return (Number(b.cancelled ?? 0) + Number(b.incomplete_cancelled ?? 0)) -
      (Number(a.cancelled ?? 0) + Number(a.incomplete_cancelled ?? 0));
  });
}

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

    employeePerformance = await getLiveEmployeeCancellationPerformance(data.from, data.to, employeePerformance);

    const [productsR, customersR, todayVisitorsR] = await Promise.all([
      supabaseAdmin.from("products").select("id,name,stock,is_active,cost").eq("is_active", true).order("stock", { ascending: true }).limit(100),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("site_visitors")
        .select("id", { count: "exact", head: true })
        .gte("last_seen", new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) + "T00:00:00+06:00").toISOString())
        .or("path.eq./,path.like./landing/*"),
    ]);
    for (const result of [productsR, customersR, todayVisitorsR]) if (result.error) throw new Error(result.error.message);

    const products = productsR.data ?? [];
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
      todayVisitors: Number(todayVisitorsR.count ?? 0),
      employeePerformance,
      customerCount: Number(customersR.count ?? 0),
    };
  });
