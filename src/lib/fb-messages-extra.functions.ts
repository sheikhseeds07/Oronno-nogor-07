import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function guard(userId: string) {
  const { assertIsStaff } = await import("@/lib/_admin-guard.server");
  await assertIsStaff(userId);
}

export const deleteSelectedFbTrainerMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { error } = await supabaseAdmin.from("fb_trainer_messages").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: data.ids.length };
  });

export const ensureFbAutopilotCutoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { data } = await supabaseAdmin.from("integrations").select("config,is_active").eq("name", "facebook_page").maybeSingle();
    const config = (data?.config as Record<string, unknown> | null) ?? {};
    const cutoff = typeof config.autopilot_since === "string" ? config.autopilot_since : new Date().toISOString();
    const { error } = await supabaseAdmin.from("integrations").upsert({
      name: "facebook_page", is_active: data?.is_active ?? true,
      config: { ...config, autopilot_since: cutoff }, updated_at: new Date().toISOString(),
    }, { onConflict: "name" });
    if (error) throw new Error(error.message);
    return { cutoff };
  });
