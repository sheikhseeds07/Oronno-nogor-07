import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const InputSchema = z.object({ from: z.string(), to: z.string() });

export const getVisitorStats = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const [{ count: totalVisits }, { count: totalAll }, sessionsRes] = await Promise.all([
      supabaseAdmin.from("site_visits").select("*", { count: "exact", head: true })
        .gte("created_at", data.from).lte("created_at", data.to),
      supabaseAdmin.from("site_visits").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("site_visits").select("session_id")
        .gte("created_at", data.from).lte("created_at", data.to).limit(50000),
    ]);
    const sessions = new Set((sessionsRes.data ?? []).map((r) => r.session_id)).size;
    return {
      visitsInRange: totalVisits ?? 0,
      uniqueVisitorsInRange: sessions,
      totalVisitsAllTime: totalAll ?? 0,
    };
  });
