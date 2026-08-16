import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
const approvedStatuses = new Set(["shipped", "delivered", "rts", "hold", "partial", "pending_return", "returned"]);

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

    const [{ data: orders, error: ordersError }, { data: incompleteEvents, error: incompleteError }, { data: products, error: productsError }, { count: customers, error: customersError }] = await Promise.all([
      db.from("orders").select("id,source,status,total,created_at,updated_at,originated_from_incomplete").gte("created_at", data.from).lte("created_at", data.to).limit(20000),
      db.from("incomplete_events").select("event,created_at").gte("created_at", data.from).lte("created_at", data.to).limit(20000),
      db.from("products").select("id,name,stock,is_active").eq("is_active", true).order("stock", { ascending: true }).limit(1000),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    const firstError = ordersError ?? incompleteError ?? productsError ?? customersError;
    if (firstError) throw new Error(firstError.message);

    const list = orders ?? [];
    const directWeb = list.filter((o) => o.source === "web" && !o.originated_from_incomplete);
    const converted = list.filter((o) => o.originated_from_incomplete);
    const realApproved = directWeb.filter((o) => approvedStatuses.has(String(o.status))).length;
    const realCancelled = directWeb.filter((o) => o.status === "cancelled").length;
    const realPending = directWeb.filter((o) => o.status === "web_pending").length;
    const realRevenue = directWeb.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const incompleteCreated = (incompleteEvents ?? []).filter((e) => e.event === "created").length;
    const incompleteCancelled = (incompleteEvents ?? []).filter((e) => e.event === "cancelled").length;
    const incompleteConverted = (incompleteEvents ?? []).filter((e) => e.event === "converted").length;
    const convertedApproved = converted.filter((o) => approvedStatuses.has(String(o.status))).length;
    const convertedCancelled = converted.filter((o) => o.status === "cancelled").length;
    const currentWebPending = converted.filter((o) => o.status === "web_pending").length;

    const dayMap = new Map<string, { day: string; created: number; approved: number; cancelled: number }>();
    const ensureDay = (iso: string) => {
      const day = iso.slice(0, 10);
      let row = dayMap.get(day);
      if (!row) { row = { day, created: 0, approved: 0, cancelled: 0 }; dayMap.set(day, row); }
      return row;
    };
    for (const o of directWeb) {
      const row = ensureDay(o.created_at ?? data.from);
      row.created += 1;
      if (approvedStatuses.has(String(o.status))) row.approved += 1;
      if (o.status === "cancelled") row.cancelled += 1;
    }
    for (const e of incompleteEvents ?? []) {
      if (e.event === "created") ensureDay(e.created_at).created += 1;
      if (e.event === "cancelled") ensureDay(e.created_at).cancelled += 1;
      if (e.event === "converted") ensureDay(e.created_at).approved += 1;
    }

    const orderIds = list.map((o) => o.id);
    let bestSelling: Array<{ name: string; units: number; revenue: number }> = [];
    if (orderIds.length) {
      const { data: items, error: itemsError } = await db.from("order_items").select("order_id,product_id,product_name,quantity,subtotal").in("order_id", orderIds).limit(30000);
      if (itemsError) throw new Error(itemsError.message);
      const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
      for (const item of items ?? []) {
        const row = byProduct.get(item.product_id) ?? { name: item.product_name, units: 0, revenue: 0 };
        row.units += Number(item.quantity) || 0;
        row.revenue += Number(item.subtotal) || 0;
        byProduct.set(item.product_id, row);
      }
      bestSelling = Array.from(byProduct.values()).sort((a, b) => b.units - a.units).slice(0, 5);
    }

    const lowStock = (products ?? []).filter((p) => (p.stock ?? 0) <= 5).slice(0, 6).map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));
    const stockSummary = {
      total: products?.length ?? 0,
      low: (products ?? []).filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length,
      out: (products ?? []).filter((p) => (p.stock ?? 0) <= 0).length,
    };

    return {
      real: { created: directWeb.length, approved: realApproved, cancelled: realCancelled, pending: realPending, revenue: realRevenue },
      incomplete: { created: incompleteCreated, cancelled: incompleteCancelled, converted: incompleteConverted, currentWebPending, convertedApproved, convertedCancelled },
      daily: Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      bestSelling,
      lowStock,
      stockSummary,
      customers: customers ?? 0,
      products: products?.length ?? 0,
    };
  });
