import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { assertIsAdmin } from "@/lib/_admin-guard.server";

// The CAPI access token is secret configuration. Read it only on the server
// after validating the caller's session and admin role.
export const getFacebookCapiConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("config,is_active")
      .eq("name", "facebook_capi")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });
