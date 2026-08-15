import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  return !!data?.length;
}

export const getEmployeePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid(), start: z.string(), end: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId && !(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const start = new Date(`${data.start}T00:00:00`).toISOString();
    const endDate = new Date(`${data.end}T23:59:59.999`);
    const end = endDate.toISOString();

    const { data: attendance } = await supabaseAdmin.from("attendance").select("id,check_in,check_out").eq("user_id", data.user_id).gte("check_in", start).lte("check_in", end).order("check_in", { ascending: false });
    let hours = 0;
    (attendance ?? []).forEach((a) => {
      const out = a.check_out ? new Date(a.check_out).getTime() : Date.now();
      const ms = out - new Date(a.check_in).getTime();
      if (ms > 0) hours += ms / 3600000;
    });

    let confirmed = 0, cancelled = 0, webOrder = 0, incomplete = 0;
    try {
      const { data: orders } = await supabaseAdmin.from("orders").select("id,status,source,created_at").or(`assigned_to.eq.${data.user_id},created_by.eq.${data.user_id}`).gte("created_at", start).lte("created_at", end);
      for (const o of orders ?? []) {
        const status = String(o.status ?? "").toLowerCase();
        if (["confirmed", "processing", "approved", "delivered", "shipped"].includes(status)) confirmed++;
        if (["cancelled", "canceled", "returned"].includes(status)) cancelled++;
        const source = String(o.source ?? "").toLowerCase().replace(/[\s_-]/g, "");
        if (["web", "weborder", "website", "online"].includes(source)) webOrder++;
        if (["incomplete", "incompleteorder", "abandoned"].includes(source)) incomplete++;
      }
    } catch {
      // Keep attendance/profile usable when an older orders schema lacks attribution fields.
    }

    return {
      confirmed,
      cancelled,
      webOrder,
      incomplete,
      totalOrders: confirmed + cancelled,
      totalHours: Math.round(hours * 10) / 10,
      attendance: attendance ?? [],
    };
  });
