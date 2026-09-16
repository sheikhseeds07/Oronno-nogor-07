import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertPermission } from "@/lib/_admin-guard.server";


const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

const isRetryable = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return !/401|403|unauthorized|forbidden|invalid token|permission denied|invalid date/.test(message);
};

async function invokeMeta(supabase: any, body: Record<string, unknown>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke("admin-bridge", { body });
    if (!error) {
      if (data?.error && data?.connected !== false) throw new Error(String(data.error));
      return data;
    }
    lastError = error;
    if (!isRetryable(error) || attempt === 2) break;
    await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("Meta Ads request failed");
}

export const getMetaAdsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context.userId, "meta_ad_account", "dashboard_meta_ads");
    return invokeMeta(context.supabase, {
      action: "meta_dashboard",
      from: data.from,
      to: data.to,
    });
  });
