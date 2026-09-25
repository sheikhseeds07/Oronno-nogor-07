import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { isMassageOrder } from "@/lib/order-origin";

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
async function fetchAllActionEvents(db: any, action: string, from: string, to: string, actorId?: string) {
  const pageSize = 1000;
  const all: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from("order_action_events").select("order_id,actor_id,action,created_at")
      .eq("action", action).gte("created_at", from).lte("created_at", to)
      .order("created_at", { ascending: true }).range(offset, offset + pageSize - 1);
    if (actorId) query = query.eq("actor_id", actorId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }
  return all;
}

async function fetchRowsByIds(db: any, table: string, columns: string, ids: string[], idColumn = "id") {
  const chunkSize = 500;
  const all: any[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const { data, error } = await db.from(table).select(columns).in(idColumn, ids.slice(i, i + chunkSize));
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
  }
  return all;
}

async function getLiveEmployeeCancellationPerformance(from: string, to: string, baseRows: any[]) {
  const db = supabaseAdmin as any;

  const [employeesR, divisionMembersR, processingR, confirmEvents] = await Promise.all([
    db.from("employees").select("user_id,name").eq("is_active", true),
    db.from("order_distribution_members").select("user_id,enabled").eq("enabled", true),
    db.from("orders").select("assigned_to").eq("status", "web_pending").eq("originated_from_import", false).not("assigned_to", "is", null),
    fetchAllActionEvents(db, "confirm", from, to),
  ]);

  if (employeesR.error) throw new Error(employeesR.error.message);
  if (processingR.error) throw new Error(processingR.error.message);
  if (divisionMembersR.error) throw new Error(divisionMembersR.error.message);
  const orderDivisionActiveIds = new Set(
    (divisionMembersR.data ?? []).map((row: any) => String(row?.user_id ?? "")).filter(Boolean)
  );

  // Build confirmation metrics directly from the persistent action log.
  // This is the source of truth for Web Confirm / Incomplete Confirm.
  const confirmIds = Array.from(new Set(
    confirmEvents.map((e: any) => String(e?.order_id ?? "")).filter(Boolean)
  ));

  const confirmOrderRows = confirmIds.length
    ? await fetchRowsByIds(db, "orders", "id,source,originated_from_import,notes", confirmIds)
    : [];
  const confirmSourceByOrder = new Map<string, string>(
    confirmOrderRows.map((row: any) => [String(row.id), isMassageOrder(row) ? "__import__" : String(row.source ?? "").toLowerCase()])
  );

  // Imported/deleted orders can still have confirmation events. Fill missing
  // sources from deleted_orders without making cancellation data a dependency.
  const missingConfirmIds = confirmIds.filter((id) => !confirmSourceByOrder.has(id));
  if (missingConfirmIds.length) {
    const deletedConfirmRows = await fetchRowsByIds(db, "deleted_orders", "id,order_data", missingConfirmIds);
    for (const row of deletedConfirmRows) {
        const data = row?.order_data && typeof row.order_data === "object" ? row.order_data : {};
        confirmSourceByOrder.set(String(row.id), isMassageOrder(data) ? "__import__" : String(data?.source ?? "").toLowerCase());
      }
    }

  // Live Processing is a current operational metric, not an employee-permission metric.
  // Build it from every assigned web_pending order so every employee row receives
  // its own real-time count, regardless of that employee's dashboard permissions.
  const liveProcessingByEmployee = new Map<string, number>();
  for (const order of processingR.data ?? []) {
    const id = String(order?.assigned_to ?? "");
    if (!id) continue;
    liveProcessingByEmployee.set(id, (liveProcessingByEmployee.get(id) ?? 0) + 1);
  }

  const rows = new Map<string, any>();
  for (const row of baseRows) {
    const id = String(row?.user_id ?? "");
    if (!id) continue;
    rows.set(id, {
      ...row,
      confirmed: 0,
      web_confirmed: 0,
      incomplete_confirmed: 0,
      cancelled: 0,
      incomplete_cancelled: 0,
      massage_confirmed: 0,
      massage_cancelled: 0,
      total: 0,
      live_processing: liveProcessingByEmployee.get(id) ?? 0,
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
        massage_confirmed: 0,
        massage_cancelled: 0,
        total: 0,
        live_processing: liveProcessingByEmployee.get(id) ?? 0,
        order_division_active: orderDivisionActiveIds.has(id),
      });
    } else {
      rows.get(id).name = employee?.name ?? rows.get(id).name;
    }
  }

  for (const event of confirmEvents) {
    const actor = String(event?.actor_id ?? "");
    const orderId = String(event?.order_id ?? "");
    if (!actor || !orderId) continue;

    const target = rows.get(actor);
    if (!target) continue;

    const source = confirmSourceByOrder.get(orderId) ?? "";
    if (source === "web") target.web_confirmed += 1;
    else if (source === "incomplete") target.incomplete_confirmed += 1;
    else if (source === "__import__") target.massage_confirmed += 1;
  }

  // Cancellation metrics are supplementary and must never be allowed to
  // wipe/zero the real confirmation metrics if their history is unavailable.
  try {
    const cancelEvents = await fetchAllActionEvents(db, "cancel", from, to);
    if (cancelEvents) {
      const cancelIds = Array.from(new Set(
        cancelEvents.map((e: any) => String(e?.order_id ?? "")).filter(Boolean)
      ));

      const [ordersRows, deletedRows, cancelHistoryRows] = await Promise.all([
        cancelIds.length ? fetchRowsByIds(db, "orders", "id,source,originated_from_import,notes", cancelIds) : Promise.resolve([]),
        cancelIds.length ? fetchRowsByIds(db, "deleted_orders", "id,order_data", cancelIds) : Promise.resolve([]),
        cancelIds.length ? fetchRowsByIds(db, "order_cancellation_history", "order_id,source,cancelled_at", cancelIds, "order_id") : Promise.resolve([]),
      ]);

      const sourceByOrder = new Map<string, string>();
      for (const row of ordersRows) sourceByOrder.set(String(row.id), isMassageOrder(row) ? "__import__" : String(row.source ?? "").toLowerCase());
      for (const row of deletedRows) {
        if (!sourceByOrder.has(String(row.id))) {
          const data = row?.order_data && typeof row.order_data === "object" ? row.order_data : {};
          sourceByOrder.set(String(row.id), isMassageOrder(data) ? "__import__" : String(data?.source ?? "").toLowerCase());
        }
      }
      const cancelSourceByOrder = new Map<string, string>();
      for (const row of cancelHistoryRows) cancelSourceByOrder.set(String(row.order_id), String(row.source ?? "").toLowerCase());

      for (const event of cancelEvents) {
        const actor = String(event?.actor_id ?? "");
        const orderId = String(event?.order_id ?? "");
        const target = rows.get(actor);
        if (!target || !orderId) continue;

        // Massage/import origin is authoritative. Do not let an older
        // cancellation-history source ("web") hide a massage cancellation.
        const orderSource = sourceByOrder.get(orderId) ?? "";
        if (orderSource === "__import__") {
          target.massage_cancelled += 1;
          continue;
        }

        const source = cancelSourceByOrder.get(orderId) ?? orderSource;
        if (source === "incomplete") target.incomplete_cancelled += 1;
        else if (source === "web") target.cancelled += 1;
      }
    }
  } catch {
    // Keep real confirmation metrics even if cancellation history is unavailable.
  }

  for (const row of rows.values()) {
    row.confirmed =
      Number(row.web_confirmed ?? 0) +
      Number(row.incomplete_confirmed ?? 0) +
      Number(row.massage_confirmed ?? 0);
    row.total = row.confirmed + Number(row.cancelled ?? 0) + Number(row.incomplete_cancelled ?? 0);
  }

  return Array.from(rows.values()).sort((a, b) =>
    Number(b.confirmed ?? 0) - Number(a.confirmed ?? 0) ||
    ((Number(b.cancelled ?? 0) + Number(b.incomplete_cancelled ?? 0)) -
      (Number(a.cancelled ?? 0) + Number(a.incomplete_cancelled ?? 0)))
  );
}

const EmployeeMetricSchema = z.object({
  userId: z.string().uuid(),
  metric: z.enum(["web_confirm", "incomplete_confirm", "massage_confirm", "web_cancel", "incomplete_cancel", "massage_cancel", "live_processing"]),
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
    const roles = (role.data ?? []).map((r: any) => String(r.role));
    const isAdminRole = roles.includes("admin") || roles.includes("super_admin");
    if (!isAdminRole) throw new Error("Forbidden");

    const db = supabaseAdmin as any;
    if (data.metric === "live_processing") {
      const { data: processingOrders, error: processingError } = await db
        .from("orders")
        .select("id,source,originated_from_import,notes,invoice_no,customer_name,customer_phone,total,status,created_at,updated_at")
        .eq("assigned_to", data.userId)
        .eq("status", "web_pending")
        .eq("originated_from_import", false)
        .order("updated_at", { ascending: false });
      if (processingError) throw new Error(processingError.message);
      return (processingOrders ?? []).map((o: any) => ({ ...o, archived: false }));
    }
    const action = data.metric === "web_confirm" || data.metric === "incomplete_confirm" || data.metric === "massage_confirm" ? "confirm" : "cancel";
    const events = await fetchAllActionEvents(db, action, data.from, data.to, data.userId);

    const eventIds = Array.from(new Set((events ?? []).map((e: any) => String(e.order_id ?? "")).filter(Boolean)));
    if (!eventIds.length) return [];

    const historyRows = data.metric === "web_cancel" || data.metric === "incomplete_cancel" || data.metric === "massage_cancel"
      ? await fetchRowsByIds(db, "order_cancellation_history", "order_id,source,cancelled_at", eventIds, "order_id")
      : [];

    const sourceByOrder = new Map<string, string>(historyRows.map((h: any) => [String(h.order_id), String(h.source ?? "").toLowerCase()]));
    for (const id of eventIds) {
      if (!sourceByOrder.has(id)) sourceByOrder.set(id, "");
    }
    if (data.metric === "massage_cancel") {
      const cancelOrders = await fetchRowsByIds(db, "orders", "id,source,originated_from_import,notes", eventIds);
      for (const o of cancelOrders) {
        if (isMassageOrder(o)) sourceByOrder.set(String(o.id), "massage");
      }
      const deletedCancelOrders = await fetchRowsByIds(db, "deleted_orders", "id,order_data", eventIds);
      for (const o of deletedCancelOrders) {
        if (isMassageOrder(o?.order_data)) sourceByOrder.set(String(o.id), "massage");
      }
    }
    const ids = data.metric === "web_cancel" || data.metric === "incomplete_cancel" || data.metric === "massage_cancel"
      ? eventIds.filter((id) => {
          const source = sourceByOrder.get(id);
          if (data.metric === "massage_cancel") return source === "massage";
          return source === (data.metric === "incomplete_cancel" ? "incomplete" : "web");
        })
      : eventIds;

    if (!ids.length) return [];

    const [ordersRows, deletedRows] = await Promise.all([
      fetchRowsByIds(db, "orders", "id,source,originated_from_import,notes,invoice_no,customer_name,customer_phone,total,status,created_at,updated_at", ids),
      fetchRowsByIds(db, "deleted_orders", "id,order_data,invoice_no,customer_name,customer_phone,total,original_status,original_created_at,deleted_at", ids),
    ]);

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

    const filteredIds = (data.metric === "web_confirm" || data.metric === "incomplete_confirm" || data.metric === "massage_confirm")
      ? eventIds.filter((id) => {
          const live = ordersRows.find((o: any) => String(o.id) === id);
          const archived = deletedRows.find((o: any) => String(o.id) === id);
          const source = isMassageOrder(live ?? archived?.order_data) ? "__import__" : String(live?.source ?? archived?.order_data?.source ?? "").toLowerCase();
          if (data.metric === "massage_confirm") return isMassageOrder(live ?? archived?.order_data);
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
    const roles = (role.data ?? []).map((r: any) => String(r.role));
    const isAdminRole = roles.includes("admin") || roles.includes("super_admin");
    if (!isAdminRole) throw new Error("Forbidden");

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

export const getEmployeeLiveProcessingCounts = createServerFn({ method: "POST" })
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

    const db = supabaseAdmin as any;
    const [employeesR, processingR] = await Promise.all([
      db.from("employees").select("user_id,name").eq("is_active", true),
      db.from("orders").select("assigned_to").eq("status", "web_pending").eq("originated_from_import", false).not("assigned_to", "is", null),
    ]);
    if (employeesR.error) throw new Error(employeesR.error.message);
    if (processingR.error) throw new Error(processingR.error.message);

    const counts = new Map<string, number>();
    for (const order of processingR.data ?? []) {
      const id = String(order?.assigned_to ?? "");
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return (employeesR.data ?? []).map((employee: any) => ({
      user_id: String(employee.user_id),
      name: employee.name ?? "Unknown",
      live_processing: counts.get(String(employee.user_id)) ?? 0,
    }));
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

    // Total Processing must match the live Order List Processing queue.
    // Count every order currently in web_pending, regardless of source/import origin.
    const { count, error } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "web_pending");
    if (error) throw new Error(error.message);
    return Number(count ?? 0);
  });

export const getEmployeeMonthlyBonusProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = supabaseAdmin as any;
    const r = await db.rpc("employee_monthly_bonus_progress");
    if (r.error) throw new Error(r.error.message);
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!row) return { visible: false };
    return {
      visible: true,
      employeeName: row.employee_name ?? "আপনি",
      confirmed: Number(row.confirmed ?? 0),
      delivered: Number(row.delivered ?? 0),
      cancelled: Number(row.cancelled ?? 0),
      target: Number(row.target ?? 300),
    };
  });

export const getOptimizedDashboardReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "super_admin", "employee"]).limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const db = supabaseAdmin as any;

    // Dashboard must render even when one auxiliary metric is temporarily
    // unavailable. The summary RPC is the primary data source; confirmed
    // count and Meta spend are allowed to fail independently.
    const [summaryR, confirmedCountR, metaProfitR] = await Promise.allSettled([
      db.rpc("dashboard_egress_summary", { p_from: data.from, p_to: data.to }),
      db.rpc("dashboard_confirmed_order_count", { p_from: data.from, p_to: data.to }),
      getMetaProfitData(data.from, data.to),
    ]);

    const summaryResult = summaryR.status === "fulfilled" ? summaryR.value : null;
    const confirmedResult = confirmedCountR.status === "fulfilled" ? confirmedCountR.value : null;
    const fallbackMeta = {
      dollarRate: 122,
      courierCostPerOrder: 50,
      cancelRate: 20,
      adSpendUsd: 0,
      adSpendBdt: 0,
      connected: false,
      accountName: "",
      error: metaProfitR.status === "rejected"
        ? (metaProfitR.reason instanceof Error ? metaProfitR.reason.message : "Meta spend unavailable")
        : null,
    };
    const metaProfit = metaProfitR.status === "fulfilled" ? metaProfitR.value : fallbackMeta;

    // Keep the dashboard usable even if the summary RPC has a transient
    // failure. Never replace a successful summary with an empty response.
    if (summaryResult?.error) {
      throw new Error(summaryResult.error.message);
    }
    const s: any = summaryResult?.data ?? {};
    const confirmedRpcValue = confirmedResult && !confirmedResult.error
      ? Number(confirmedResult.data ?? 0)
      : null;
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
    const confirmedOrders = confirmedRpcValue ?? Number(real.approved ?? real.confirmed ?? 0);
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
