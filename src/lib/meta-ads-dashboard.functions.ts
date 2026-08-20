import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

export const getMetaAdsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.functions.invoke("admin-bridge", {
      body: { action: "meta_dashboard", from: data.from, to: data.to },
    });
    if (error) throw new Error(error.message || "Meta Ads request failed");
    if (result?.error && result?.connected !== false) throw new Error(String(result.error));
    return result;
  });
