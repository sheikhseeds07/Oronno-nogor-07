import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

// In this app, web_pending is the review queue. Once an order leaves web_pending
// and is not cancelled, it is considered approved/accepted by the team.
const APPROVED_STATUSES = new Set([
  "pending",
  "shipped",
  "delivered",
  "rts",
  "hold",
  "partial",
  "pending_return",
  "returned",
]);

const isApproved = (status: unknown) => APPROVED_STATUSES.has(String(status));
const isCancelled = (status: unknown) => String(status) === "cancelled";
const isWebPending = (status: unknown) => String(status) === "web_pending";

async function assertStaff(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin", "employee"]);
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
      db
        .from("orders")
        .select("id,source,status,total,created_at,updated_at,originated_from_incomplete")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(20000),
      db
        .from("incomplete_events")
        .select("phone,event,created_at")
        .gte("created_at", data.from)
        .lte("created_at", data.to)
        .limit(20000),
      db
        .from("products")
        .select("id,name,stock,is_active")
        .eq("is_active", true)
        .order("stock", { ascending: true })
        .limit(1000),
      db.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const firstError =
      ordersResult.error ??
      incompleteEventsResult.error ??
      productsResult.error ??
      customersResult.error;
    if (firstError) throw new Error(firstError.message);

    const orders = ordersResult.data ?? [];
    const incompleteEvents = incompleteEventsResult.data ?? [];
    const products = productsResult.data ?? [];

    // SOURCE and STATUS are deliberately independent, EcomDrive-style.
    // A web order converted from incomplete remains linked to its origin but is
    // excluded from the "real web" bucket so the two funnels never double count.
    const realWeb = orders.filter(
      (o) => String(o.source) === "web" && !o.originated_from_incomplete,
    );
    const convertedOrders = orders.filter((o) => Boolean(o.originated_from_incomplete));

    const realApproved = realWeb.filter((o) => isApproved(o.status)).length;
    const realCancelled = realWeb.filter((o) => isCancelled(o.status)).length;
    const realPending = realWeb.filter((o) => isWebPending(o.status)).length;
    const realRevenue = realWeb.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const incompleteCreated = incompleteEvents.filter((e) => e.event === "created").length;
    const incompleteCancelled = incompleteEvents.filter((e) => e.event === "cancelled").length;
    const incompleteConverted = incompleteEvents.filter((e) => e.event === "converted").length;
    const convertedApproved = convertedOrders.filter((o) => isApproved(o.status)).length;
    const convertedCancelled = convertedOrders.filter((o) => isCancelled(o.status)).length;
    const convertedPending = convertedOrders.filter((o) => isWebPending(o.status)).length;

    // Current incomplete queue: latest event per phone wins inside the selected
    // period. This gives the dashboard a live lead-state view rather than simply
    // counting every historical "created" event.
    const latestByPhone = new Map<string, { event: string; created_at: string }>();
    for (const event of incompleteEvents) {
      const phone = String(event.phone || "").trim();
      if (!phone) continue;
      const previous = latestByPhone.get(phone);
      if (!previous || new Date(event.created_at).getTime() > new Date(previous.created_at).getTime()) {
        latestByPhone.set(phone, { event: event.event, created_at: event.created_at });
      }
    }
    const openIncompleteLeads = Array.from(latestByPhone.values()).filter(
      (x) => x.event === "created",
    ).length;

    const incompleteFunnel = {
      created: incompleteCreated,
      webPending: incompleteConverted,
      approved: convertedApproved,
      cancelled: convertedCancelled + incompleteCancelled,
      currentWebPending: convertedPending,
      openLeads: openIncompleteLeads,
    };

    const sourceBreakdown = new Map<string, number>();
    for (const order of orders) {
      const source = String(order.source || "unknown");
      sourceBreakdown.set(source, (sourceBreakdown.get(source) ?? 0) + 1);
    }

    const statusBreakdown = new Map<string, number>();
    for (const order of orders) {
      const status = String(order.status || "unknown");
      statusBreakdown.set(status, (statusBreakdown.get(status) ?? 0) + 1);
    }

    const dayMap = new Map<
      string,
      { day: string; created: number; approved: number; cancelled: number; incomplete: number; converted: number }
    >();
    const ensureDay = (iso: string) => {
      const day = iso.slice(0, 10);
      let row = dayMap.get(day);
      if (!row) {
        row = { day, created: 0, approved: 0, cancelled: 0, incomplete: 0, converted: 0 };
        dayMap.set(day, row);
      }
      return row;
    };

    for (const order of realWeb) {
      const row = ensureDay(order.created_at ?? data.from);
      row.created += 1;
      if (isApproved(order.status)) row.approved += 1;
      if (isCancelled(order.status)) row.cancelled += 1;
    }

    for (const event of incompleteEvents) {
      const row = ensureDay(event.created_at);
      if (event.event === "created") row.incomplete += 1;
      if (event.event === "converted") row.converted += 1;
      if (event.event === "cancelled") row.cancelled += 1;
    }

    const orderIds = orders.map((o) => o.id);
    let bestSelling: Array<{ name: string; units: number; revenue: number }> = [];
    if (orderIds.length) {
      const { data: items, error: itemsError } = await db
        .from("order_items")
        .select("order_id,product_id,product_name,quantity,subtotal")
        .in("order_id", orderIds)
        .limit(30000);
      if (itemsError) throw new Error(itemsError.message);

      const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
      for (const item of items ?? []) {
        const row = byProduct.get(item.product_id) ?? {
          name: item.product_name,
          units: 0,
          revenue: 0,
        };
        row.units += Number(item.quantity) || 0;
        row.revenue += Number(item.subtotal) || 0;
        byProduct.set(item.product_id, row);
      }
      bestSelling = Array.from(byProduct.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, 5);
    }

    const lowStock = (products ?? [])
      .filter((p) => (p.stock ?? 0) <= 5)
      .slice(0, 6)
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 }));

    const stockSummary = {
      total: products.length,
      low: products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length,
      out: products.filter((p) => (p.stock ?? 0) <= 0).length,
    };

    return {
      real: {
        created: realWeb.length,
        approved: realApproved,
        cancelled: realCancelled,
        pending: realPending,
        revenue: realRevenue,
      },
      incomplete: {
        ...incompleteFunnel,
        converted: incompleteConverted,
        convertedApproved: convertedApproved,
        convertedCancelled: convertedCancelled,
      },
      sourceBreakdown: Array.from(sourceBreakdown.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      statusBreakdown: Array.from(statusBreakdown.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      daily: Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      bestSelling,
      lowStock,
      stockSummary,
      customers: customersResult.count ?? 0,
      products: products.length,
    };
  });
