import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const empty = { total: 0, confirmed: 0, processing: 0, cancelled: 0 };

export const getOptimizedDashboardReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const role = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "super_admin", "employee"]).limit(1);
    if (role.error) throw new Error(role.error.message);
    if (!role.data?.length) throw new Error("Unauthorized");

    const { data: summary, error } = await supabaseAdmin.rpc("dashboard_egress_summary", {
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(error.message);

    const s: any = summary ?? {};
    const real = s.real ?? { ...empty, created: 0, revenue: 0, allRevenue: 0, approved: 0, pending: 0 };
    const web = s.webOrders ?? empty;
    const incomplete = s.incompleteOrders ?? { ...empty, active: 0 };
    const daily = Array.isArray(s.daily) ? s.daily : [];
    const bestSelling = Array.isArray(s.bestSelling) ? s.bestSelling : [];
    const sourceBreakdown = Array.isArray(s.sourceBreakdown) ? s.sourceBreakdown : [];

    const [productsR, employeesR, customersR, todayVisitorsR, liveVisitorsR, landingR] = await Promise.all([
      supabaseAdmin.from("products").select("id,name,stock,is_active,cost").eq("is_active", true).order("stock", { ascending: true }).limit(100),
      supabaseAdmin.from("employees").select("id,name,user_id,is_active").eq("is_active", true).order("name").limit(100),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("site_visitors").select("id", { count: "exact", head: true }).gte("last_seen", new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) + "T00:00:00+06:00").toISOString()),
      supabaseAdmin.from("site_visitors").select("id", { count: "exact", head: true }).gte("last_seen", new Date(Date.now() - 120000).toISOString()),
      supabaseAdmin.from("landing_pages").select("id,title,slug,product_id,is_published").eq("is_published", true).limit(100),
    ]);
    for (const r of [productsR, employeesR, customersR, todayVisitorsR, liveVisitorsR, landingR]) if (r.error) throw new Error(r.error.message);

    const products = productsR.data ?? [];
    const lowStock = products.filter((p: any) => Number(p.stock ?? 0) <= 5).slice(0, 10).map((p: any) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
    const stockSummary = { total: products.length, low: products.filter((p: any) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= 5).length, out: products.filter((p: any) => Number(p.stock ?? 0) <= 0).length };
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`, orders: 0 }));
    for (const d of daily) { const hour = Number(d.hour); if (hour >= 0 && hour < 24) hourly[hour].orders = Number(d.orders ?? 0); }

    return {
      real: { ...real, total: Number(real.total ?? real.created ?? 0), approved: Number(real.approved ?? real.confirmed ?? 0) },
      webOrders: web,
      incompleteOrders: incomplete,
      profit: { grossSales: Number(s.profit?.grossSales ?? real.revenue ?? 0), productCost: Number(s.profit?.productCost ?? 0), adSpendUsd: 0, adSpendBdt: 0, dollarRate: 122, confirmedOrders: Number(real.approved ?? real.confirmed ?? 0), courierCost: 0, courierCostPerOrder: 50, cancelRate: 20, cancellationAdjustment: 0, netProfit: Number(s.profit?.grossSales ?? real.revenue ?? 0) - Number(s.profit?.productCost ?? 0), netProfitMargin: 0, connected: false, accountName: "" },
      sourceBreakdown,
      daily,
      hourly,
      earnings: [],
      bestSelling,
      lowStock,
      stockSummary,
      liveVisitors: Number(liveVisitorsR.count ?? 0),
      todayVisitors: Number(todayVisitorsR.count ?? 0),
      liveLandingPages: landingR.data ?? [],
      employeePerformance: (employeesR.data ?? []).map((e: any) => ({ user_id: e.user_id ?? e.id, name: e.name, confirmed: 0, cancelled: 0, total: 0 })),
      customerCount: Number(customersR.count ?? 0),
    };
  });
