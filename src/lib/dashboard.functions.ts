import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const APPROVED_STATUSES = new Set(["pending", "shipped", "delivered", "rts", "hold", "partial", "pending_return", "returned"]);
const isApproved = (status: unknown) => APPROVED_STATUSES.has(String(status));
const isCancelled = (status: unknown) => String(status) === "cancelled";
const isWebPending = (status: unknown) => String(status) === "web_pending";

// Web Order Report is intentionally mutually exclusive:
// every Web Order is exactly one of Processing, Approved or Cancelled.
// This guarantees Processing + Approved + Cancelled === Total Web Orders.
const getWebBucket = (status: unknown): "processing" | "approved" | "cancelled" => {
  if (isCancelled(status)) return "cancelled";
  if (isApproved(status)) return "approved";
  return "processing";
};

const bdHour = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date(iso)));
const bdMonth = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(iso));

async function assertStaff(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin", "employee"]);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Unauthorized");
}

export const getPremiumDashboardReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);

    const [ordersResult, incompleteEventsResult, productsResult, customersResult] = await Promise.all([
      db.from("orders").select("id,source,status,total,created_at,updated_at,originated_from_incomplete").gte("created_at", data.from).lte("created_at", data.to).limit(20000),
      db.from("incomplete_events").select("phone,event,created_at").gte("created_at", data.from).lte("created_at", data.to).limit(20000),
      db.from("products").select("id,name,stock,is_active").eq("is_active", true).order("stock", { ascending: true }).limit(1000),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const firstError = ordersResult.error ?? incompleteEventsResult.error ?? productsResult.error ?? customersResult.error;
    if (firstError) throw new Error(firstError.message);

    const orders = ordersResult.data ?? [];
    const incompleteEvents = incompleteEventsResult.data ?? [];
    const products = productsResult.data ?? [];
    const webOrders = orders.filter((o) => String(o.source) === "web");
    const convertedOrders = webOrders.filter((o) => Boolean(o.originated_from_incomplete));

    // IMPORTANT: these are mutually exclusive buckets. A newly placed Web
    // Order enters Processing. Approving it moves it to Approved. Cancelling
    // it moves it to Cancelled. The order never counts in two buckets.
    const webProcessing = webOrders.filter((o) => getWebBucket(o.status) === "processing").length;
    const webApproved = webOrders.filter((o) => getWebBucket(o.status) === "approved").length;
    const webCancelled = webOrders.filter((o) => getWebBucket(o.status) === "cancelled").length;
    const webTotal = webProcessing + webApproved + webCancelled;
    const webRevenue = webOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const incompleteCreated = incompleteEvents.filter((e) => e.event === "created").length;
    const incompleteCancelled = incompleteEvents.filter((e) => e.event === "cancelled").length;
    const incompleteConverted = incompleteEvents.filter((e) => e.event === "converted").length;
    const convertedApproved = convertedOrders.filter((o) => getWebBucket(o.status) === "approved").length;
    const convertedCancelled = convertedOrders.filter((o) => getWebBucket(o.status) === "cancelled").length;
    const convertedPending = convertedOrders.filter((o) => getWebBucket(o.status) === "processing").length;

    // Active Incomplete is independent from Web Orders. A phone that has
    // successfully placed an order is no longer an active incomplete lead.
    const latestByPhone = new Map<string, { event: string; created_at: string }>();
    for (const event of incompleteEvents) {
      const phone = String(event.phone || "").trim();
      if (!phone) continue;
      const previous = latestByPhone.get(phone);
      if (!previous || new Date(event.created_at).getTime() > new Date(previous.created_at).getTime()) {
        latestByPhone.set(phone, { event: event.event, created_at: event.created_at });
      }
    }
    const openIncompleteLeads = Array.from(latestByPhone.values()).filter((x) => x.event === "created").length;
    const incompleteFunnel = {
      created: incompleteCreated,
      webPending: incompleteConverted,
      approved: convertedApproved,
      cancelled: convertedCancelled + incompleteCancelled,
      currentWebPending: convertedPending,
      openLeads: openIncompleteLeads,
    };

    const sourceMap = new Map<string, { source: string; count: number; revenue: number }>();
    for (const order of orders) {
      const source = String(order.source || "unknown");
      const row = sourceMap.get(source) ?? { source, count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += Number(order.total) || 0;
      sourceMap.set(source, row);
    }

    const statusBreakdown = new Map<string, number>();
    for (const order of orders) {
      const status = String(order.status || "unknown");
      statusBreakdown.set(status, (statusBreakdown.get(status) ?? 0) + 1);
    }

    const dayMap = new Map<string, { day: string; created: number; processing: number; approved: number; cancelled: number; incomplete: number; converted: number }>();
    const ensureDay = (iso: string) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
      let row = dayMap.get(day);
      if (!row) {
        row = { day, created: 0, processing: 0, approved: 0, cancelled: 0, incomplete: 0, converted: 0 };
        dayMap.set(day, row);
      }
      return row;
    };
    for (const order of webOrders) {
      const row = ensureDay(order.created_at ?? data.from);
      row.created += 1;
      const bucket = getWebBucket(order.status);
      if (bucket === "processing") row.processing += 1;
      if (bucket === "approved") row.approved += 1;
      if (bucket === "cancelled") row.cancelled += 1;
    }
    for (const event of incompleteEvents) {
      const row = ensureDay(event.created_at);
      if (event.event === "created") row.incomplete += 1;
      if (event.event === "converted") row.converted += 1;
      if (event.event === "cancelled") row.cancelled += 1;
    }

    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`, created: 0, processing: 0, approved: 0, cancelled: 0 }));
    for (const order of webOrders) {
      const h = bdHour(order.created_at);
      hourly[h].created += 1;
      const bucket = getWebBucket(order.status);
      if (bucket === "processing") hourly[h].processing += 1;
      if (bucket === "approved") hourly[h].approved += 1;
      if (bucket === "cancelled") hourly[h].cancelled += 1;
    }

    const earningMap = new Map<string, { month: string; orders: number; revenue: number; approved: number }>();
    for (const order of webOrders) {
      const month = bdMonth(order.created_at);
      const row = earningMap.get(month) ?? { month, orders: 0, revenue: 0, approved: 0 };
      row.orders += 1;
      row.revenue += Number(order.total) || 0;
      if (getWebBucket(order.status) === "approved") row.approved += 1;
      earningMap.set(month, row);
    }

    const orderIds = orders.map((o) => o.id);
    let bestSelling: Array<{ name: string; units: number; revenue: number }> = [];
    if (orderIds.length) {
      const { data: items, error: itemsError } = await db.from("order_items").select("order_id,product_id,product_name,quantity,subtotal").in("order_id", orderIds).limit(30000);
      if (itemsError) throw new Error(itemsError.message);
      const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
      for (const item of items ?? []) {
        const key = item.product_id ?? item.product_name;
        const row = byProduct.get(key) ?? { name: item.product_name, units: 0, revenue: 0 };
        row.units += Number(item.quantity) || 0;
        row.revenue += Number(item.subtotal) || 0;
        byProduct.set(key, row);
      }
      bestSelling = Array.from(byProduct.values()).sort((a, b) => b.units - a.units).slice(0, 8);
    }

    const lowStock = products.filter((p) => (p.stock ?? 0) <= 5).slice(0, 8).map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
    const stockSummary = { total: products.length, low: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length, out: products.filter((p) => (p.stock ?? 0) <= 0).length };

    return {
      // Keep `created` as the total so existing UI remains compatible.
      // The three status counters always add up exactly to this value.
      real: {
        created: webTotal,
        total: webTotal,
        processing: webProcessing,
        approved: webApproved,
        cancelled: webCancelled,
        pending: webProcessing,
        revenue: webRevenue,
      },
      incomplete: { ...incompleteFunnel, converted: incompleteConverted, convertedApproved, convertedCancelled },
      sourceBreakdown: Array.from(sourceMap.values()).sort((a, b) => b.count - a.count),
      statusBreakdown: Array.from(statusBreakdown.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
      daily: Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      hourly,
      earnings: Array.from(earningMap.values()),
      bestSelling,
      lowStock,
      stockSummary,
      customers: customersResult.count ?? 0,
      products: products.length,
    };
  });