import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

// A real order becomes confirmed when it reaches Order List -> Pending.
// Later operational states remain confirmed historically.
const CONFIRMED = new Set(["pending", "rts", "shipped", "delivered", "pending_return", "returned", "partial", "processing", "approved"]);
const isConfirmed = (status: unknown) => CONFIRMED.has(String(status ?? "").toLowerCase());
const isCancelled = (status: unknown) => ["cancelled", "canceled"].includes(String(status ?? "").toLowerCase());
const isIncomplete = (order: any) => Boolean(order.originated_from_incomplete) || String(order.source ?? "").toLowerCase() === "incomplete";
const isRealOrder = (order: any) => !isIncomplete(order);
const isWebOrder = (order: any) => isRealOrder(order) && String(order.source ?? "").toLowerCase() === "web";
const bdDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
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

    const [ordersR, productsR, customersR, employeesR, landingR] = await Promise.all([
      db.from("orders").select("id,source,status,total,created_at,updated_at,created_by,assigned_to,originated_from_incomplete").gte("created_at", data.from).lte("created_at", data.to).limit(30000),
      db.from("products").select("id,name,stock,is_active").eq("is_active", true).order("stock", { ascending: true }).limit(2000),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("employees").select("id,name,user_id,is_active").eq("is_active", true).order("name"),
      db.from("landing_pages").select("id,title,slug,product_id,is_published").eq("is_published", true),
    ]);

    const visitorsR = await (supabaseAdmin as any).from("site_visitors").select("id,path,landing_page_id,product_id,last_seen").gte("last_seen", new Date(Date.now() - 120000).toISOString()).limit(5000);
    const queryError = ordersR.error ?? productsR.error ?? customersR.error ?? employeesR.error ?? landingR.error ?? visitorsR.error;
    if (queryError) throw new Error(queryError.message);

    const orders = ordersR.data ?? [];
    const realOrders = orders.filter(isRealOrder);
    const webOrders = realOrders.filter(isWebOrder);
    const confirmedOrders = realOrders.filter((order) => isConfirmed(order.status));
    const webPendingOrders = webOrders.filter((order) => String(order.status ?? "").toLowerCase() === "web_pending");
    const cancelledOrders = realOrders.filter((order) => isCancelled(order.status));
    const confirmedRevenue = confirmedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const webRevenue = webOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    const visitorRows = visitorsR.data ?? [];
    const landingPages = landingR.data ?? [];
    const products = productsR.data ?? [];
    const landingMap = new Map(landingPages.map((page) => [page.id, page]));
    const productMap = new Map(products.map((product) => [product.id, product]));
    const liveLandingCount = new Map<string, number>();
    const liveProductCount = new Map<string, number>();
    for (const visitor of visitorRows) {
      if (visitor.landing_page_id) liveLandingCount.set(visitor.landing_page_id, (liveLandingCount.get(visitor.landing_page_id) ?? 0) + 1);
      if (visitor.product_id) liveProductCount.set(visitor.product_id, (liveProductCount.get(visitor.product_id) ?? 0) + 1);
    }
    const liveLandingPages = Array.from(liveLandingCount.entries()).map(([id, visitors]) => ({ ...(landingMap.get(id) ?? { id, title: "Unknown", slug: "" }), visitors })).sort((a, b) => b.visitors - a.visitors);
    const liveProducts = Array.from(liveProductCount.entries()).map(([id, visitors]) => ({ ...(productMap.get(id) ?? { id, name: "Unknown", stock: 0 }), visitors })).sort((a, b) => b.visitors - a.visitors);

    const sourceMap = new Map<string, { source: string; count: number; revenue: number }>();
    for (const order of realOrders) {
      const source = String(order.source ?? "manual").toLowerCase() === "web" ? "web" : "manual";
      const existing = sourceMap.get(source) ?? { source, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(order.total || 0);
      sourceMap.set(source, existing);
    }

    const dayMap = new Map<string, { day: string; created: number; processing: number; confirmed: number; cancelled: number }>();
    for (const order of webOrders) {
      const day = bdDay(order.created_at);
      const existing = dayMap.get(day) ?? { day, created: 0, processing: 0, confirmed: 0, cancelled: 0 };
      existing.created += 1;
      if (String(order.status ?? "").toLowerCase() === "web_pending") existing.processing += 1;
      if (isConfirmed(order.status)) existing.confirmed += 1;
      if (isCancelled(order.status)) existing.cancelled += 1;
      dayMap.set(day, existing);
    }

    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`, orders: 0 }));
    for (const order of webOrders) {
      const hour = bdHour(order.created_at);
      if (hour >= 0 && hour < 24) hourly[hour].orders += 1;
    }

    const earningsMap = new Map<string, { month: string; orders: number; revenue: number; confirmed: number }>();
    for (const order of webOrders) {
      const month = bdMonth(order.created_at);
      const existing = earningsMap.get(month) ?? { month, orders: 0, revenue: 0, confirmed: 0 };
      existing.orders += 1;
      existing.revenue += Number(order.total || 0);
      if (isConfirmed(order.status)) existing.confirmed += 1;
      earningsMap.set(month, existing);
    }

    let bestSelling: Array<any> = [];
    const orderIds = realOrders.map((order) => order.id);
    if (orderIds.length) {
      const itemsR = await db.from("order_items").select("order_id,product_id,product_name,quantity,subtotal").in("order_id", orderIds).limit(50000);
      if (itemsR.error) throw new Error(itemsR.error.message);
      const confirmedIds = new Set(confirmedOrders.map((order) => order.id));
      const productSales = new Map<string, { product_id: string | null; name: string; units: number; revenue: number }>();
      for (const item of itemsR.data ?? []) {
        if (!confirmedIds.has(item.order_id)) continue;
        const key = item.product_id ?? item.product_name;
        const existing = productSales.get(key) ?? { product_id: item.product_id, name: item.product_name, units: 0, revenue: 0 };
        existing.units += Number(item.quantity || 0);
        existing.revenue += Number(item.subtotal || 0);
        productSales.set(key, existing);
      }
      bestSelling = Array.from(productSales.values()).sort((a, b) => b.units - a.units).slice(0, 10).map((item) => ({ ...item, landingPages: landingPages.filter((page) => page.product_id === item.product_id).map((page) => ({ title: page.title, slug: page.slug })) }));
    }

    const lowStock = products.filter((product) => (product.stock ?? 0) <= 5).slice(0, 10).map((product) => ({ id: product.id, name: product.name, stock: product.stock ?? 0 }));
    const stockSummary = {
      total: products.length,
      low: products.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 5).length,
      out: products.filter((product) => (product.stock ?? 0) <= 0).length,
    };

    // Confirmation attribution is based on the employee who actually owns the
    // confirmation/create action: created_by first, then assigned_to.
    const employeeMap = new Map<string, { user_id: string | null; name: string; confirmed: number; cancelled: number; total: number }>();
    for (const employee of employeesR.data ?? []) {
      employeeMap.set(String(employee.user_id || employee.id), { user_id: employee.user_id, name: employee.name, confirmed: 0, cancelled: 0, total: 0 });
    }
    for (const order of realOrders) {
      const actorId = String(order.created_by || order.assigned_to || "");
      const employee = employeeMap.get(actorId);
      if (!employee) continue;
      if (isConfirmed(order.status)) { employee.confirmed += 1; employee.total += 1; }
      else if (isCancelled(order.status)) employee.cancelled += 1;
    }

    return {
      real: {
        created: webOrders.length,
        total: webOrders.length,
        processing: webPendingOrders.length,
        approved: confirmedOrders.length,
        pending: webPendingOrders.length,
        cancelled: cancelledOrders.length,
        revenue: confirmedRevenue,
        allRevenue: webRevenue,
      },
      sourceBreakdown: Array.from(sourceMap.values()).sort((a, b) => b.count - a.count),
      daily: Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      hourly,
      earnings: Array.from(earningsMap.values()),
      bestSelling,
      lowStock,
      stockSummary,
      customers: customersR.count ?? 0,
      products: products.length,
      liveVisitors: visitorRows.length,
      liveLandingPages,
      liveProducts,
      employeePerformance: Array.from(employeeMap.values()).sort((a, b) => b.confirmed - a.confirmed),
      incomplete: orders.filter(isIncomplete).length,
    };
  });
