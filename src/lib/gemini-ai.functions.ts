import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]).limit(1);
  return Boolean(data?.length);
}

export const getGeminiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const { data, error } = await supabaseAdmin.from("site_ai_settings").select("provider,model,api_key,updated_at").limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return { provider: data?.provider ?? "gemini", model: data?.model ?? "gemini-2.5-flash", configured: Boolean(data?.api_key), maskedKey: data?.api_key ? `${data.api_key.slice(0, 6)}••••••••${data.api_key.slice(-4)}` : "" };
  });

export const saveGeminiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ api_key: z.string().trim().max(500), model: z.string().trim().min(1).max(100).default("gemini-2.5-flash") }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    const { data: row } = await supabaseAdmin.from("site_ai_settings").select("id,api_key").limit(1).maybeSingle();
    const apiKey = data.api_key || row?.api_key || "";
    const payload = { provider: "gemini", api_key: apiKey, model: data.model, updated_at: new Date().toISOString() };
    const result = row?.id
      ? await supabaseAdmin.from("site_ai_settings").update(payload).eq("id", row.id)
      : await supabaseAdmin.from("site_ai_settings").insert(payload);
    if (result.error) throw new Error(result.error.message);
    return { ok: true, configured: Boolean(apiKey) };
  });
