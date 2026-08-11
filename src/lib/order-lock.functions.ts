import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const STALE_MS = 60_000; // lock considered stale after 60s without heartbeat

async function getDisplayName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name ?? "Staff";
}

export const acquireOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_id: z.string().uuid(), takeover: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { order_id, takeover } = data;
    const { data: existing } = await supabaseAdmin
      .from("order_locks").select("*").eq("order_id", order_id).maybeSingle();

    const now = Date.now();
    const stale = existing && now - new Date(existing.heartbeat_at).getTime() > STALE_MS;
    const isOwn = existing && existing.user_id === context.userId;

    if (existing && !isOwn && !stale && !takeover) {
      return { ok: false, locked_by: existing.user_name, locked_by_id: existing.user_id };
    }

    const name = await getDisplayName(context.userId);
    const payload = { order_id, user_id: context.userId, user_name: name, locked_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("order_locks").upsert(payload, { onConflict: "order_id" });
    if (error) throw new Error(error.message);
    return { ok: true, locked_by: name, locked_by_id: context.userId };
  });

export const heartbeatOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("order_locks")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("order_id", data.order_id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const releaseOrderLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("order_locks").delete()
      .eq("order_id", data.order_id).eq("user_id", context.userId);
    return { ok: true };
  });

export const listOrderLocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_ids: z.array(z.string().uuid()).max(200) }).parse(i))
  .handler(async ({ data }) => {
    if (!data.order_ids.length) return { locks: [] as { order_id: string; user_id: string; user_name: string; heartbeat_at: string }[] };
    const { data: rows } = await supabaseAdmin
      .from("order_locks")
      .select("order_id,user_id,user_name,heartbeat_at")
      .in("order_id", data.order_ids);
    const cutoff = Date.now() - STALE_MS;
    const fresh = (rows ?? []).filter((r) => new Date(r.heartbeat_at).getTime() >= cutoff);
    return { locks: fresh };
  });
