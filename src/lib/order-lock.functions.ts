import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const STALE_MS = 60_000; // lock considered stale after 60s without heartbeat
const LOCK_LIST_CACHE_TTL_MS = 15_000;
const DISPLAY_NAME_CACHE_TTL_MS = 5 * 60_000;
const MAX_LOCK_CACHE_ENTRIES = 200;

type LockRow = { order_id: string; user_id: string; user_name: string; heartbeat_at: string };

const displayNameCache = new Map<string, { expiresAt: number; name: string }>();
const lockListCache = new Map<string, { expiresAt: number; locks: LockRow[] }>();
const lockListInFlight = new Map<string, Promise<LockRow[]>>();

function clearLockListCache() {
  lockListCache.clear();
}

function lockCacheKey(ids: string[]) {
  return Array.from(new Set(ids)).sort().join(",");
}

function writeLockCache(key: string, locks: LockRow[]) {
  if (lockListCache.size >= MAX_LOCK_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, entry] of lockListCache) {
      if (entry.expiresAt <= now) lockListCache.delete(k);
    }
    while (lockListCache.size >= MAX_LOCK_CACHE_ENTRIES) {
      const first = lockListCache.keys().next().value as string | undefined;
      if (!first) break;
      lockListCache.delete(first);
    }
  }
  lockListCache.set(key, { expiresAt: Date.now() + LOCK_LIST_CACHE_TTL_MS, locks });
}

async function getDisplayName(userId: string): Promise<string> {
  const cached = displayNameCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.name;

  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const name = data?.full_name ?? "Staff";
  displayNameCache.set(userId, { expiresAt: Date.now() + DISPLAY_NAME_CACHE_TTL_MS, name });
  return name;
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
    clearLockListCache();
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
    clearLockListCache();
    return { ok: true };
  });

export const listOrderLocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ order_ids: z.array(z.string().uuid()).max(200) }).parse(i))
  .handler(async ({ data }) => {
    if (!data.order_ids.length) return { locks: [] as LockRow[] };

    const key = lockCacheKey(data.order_ids);
    const cached = lockListCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { locks: cached.locks };
    if (cached) lockListCache.delete(key);

    const existing = lockListInFlight.get(key);
    if (existing) return { locks: await existing };

    const request = (async (): Promise<LockRow[]> => {
      const { data: rows } = await supabaseAdmin
        .from("order_locks")
        .select("order_id,user_id,user_name,heartbeat_at")
        .in("order_id", data.order_ids);
      const cutoff = Date.now() - STALE_MS;
      return (rows ?? [])
        .filter((r) => Boolean(r.order_id && r.user_id && r.heartbeat_at) && new Date(r.heartbeat_at).getTime() >= cutoff)
        .map((r) => ({
          order_id: String(r.order_id),
          user_id: String(r.user_id),
          user_name: r.user_name ?? "Staff",
          heartbeat_at: String(r.heartbeat_at),
        }));
    })();

    lockListInFlight.set(key, request);
    try {
      const fresh = await request;
      writeLockCache(key, fresh);
      return { locks: fresh };
    } finally {
      lockListInFlight.delete(key);
    }
  });
