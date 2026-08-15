import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const LOCK_SECONDS = 45;

export const acquireOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ order_id: z.string().uuid(), takeover: z.boolean().optional() })))

  .handler(async ({ data, context }) => {
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const userName = profile?.full_name || "Staff";

    const { data: existing } = await supabaseAdmin
      .from("order_locks")
      .select("user_id, user_name")
      .eq("order_id", data.order_id)
      .maybeSingle();

    if (existing && existing.user_id !== context.userId) {
      return { ok: false, locked_by: existing.user_name || "Someone else" };
    }

    const { error } = await supabaseAdmin.from("order_locks").upsert({
      order_id: data.order_id,
      user_id: context.userId,
      user_name: userName,
      locked_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    });

    return { ok: !error };
  });

export const heartbeatOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ order_id: z.string().uuid() })))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("order_locks")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("order_id", data.order_id)
      .eq("user_id", context.userId);
    return { ok: !error };
  });

export const releaseOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ order_id: z.string().uuid() })))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("order_locks").delete().eq("order_id", data.order_id).eq("user_id", context.userId);
    return { ok: true };
  });

export const listOrderLocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(zodValidator(z.object({ order_ids: z.array(z.string().uuid()) })))
  .handler(async ({ data }) => {
    // Cleanup old locks (more than 60s since heartbeat)
    const limit = new Date(Date.now() - 60000).toISOString();
    await supabaseAdmin.from("order_locks").delete().lt("heartbeat_at", limit);

    const { data: locks } = await supabaseAdmin
      .from("order_locks")
      .select("order_id, user_id, user_name")
      .in("order_id", data.order_ids);

    return { locks: locks ?? [] };
  });

