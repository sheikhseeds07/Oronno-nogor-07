import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertPermission } from "@/lib/_admin-guard.server";


const SettingsSchema = z.object({
  phone_repeat_minutes: z.number().int().min(0).max(10080).default(0),
  ip_repeat_minutes: z.number().int().min(0).max(10080).default(0),
});

export const getOrderRateLimitSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("site_settings").select("settings").maybeSingle();
  if (error) throw new Error(error.message);
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  return SettingsSchema.parse({
    phone_repeat_minutes: Number(settings.order_phone_repeat_minutes ?? 0),
    ip_repeat_minutes: Number(settings.order_ip_repeat_minutes ?? 0),
  });
});

export const saveOrderRateLimitSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPermission(context.userId, "order_rate_limit");
    const { data: row, error: readError } = await supabaseAdmin.from("site_settings").select("id,settings").maybeSingle();
    if (readError) throw new Error(readError.message);
    const current = ((row?.settings ?? {}) as Record<string, unknown>);
    const next = {
      ...current,
      order_phone_repeat_minutes: data.phone_repeat_minutes,
      order_ip_repeat_minutes: data.ip_repeat_minutes,
    };
    const result = row
      ? await supabaseAdmin.from("site_settings").update({ settings: next }).eq("id", row.id)
      : await supabaseAdmin.from("site_settings").insert({ settings: next });
    if (result.error) throw new Error(result.error.message);
    return data;
  });
