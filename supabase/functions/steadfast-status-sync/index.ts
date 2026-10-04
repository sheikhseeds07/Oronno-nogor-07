import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type R = Record<string, unknown>;
const COOLDOWN_MS = 20 * 60 * 1000;
const PAGE_SIZE = 400;
const RETRY_BATCH = 100;
const LOCK_MS = 3 * 60 * 1000;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const s = (v: unknown) => String(v ?? "").trim();
const norm = (v: string) => v.toLowerCase().trim().replace(/&/g, "and").replace(/[\s-]+/g, "_");

function map(v: string): "delivered" | "partial" | "pending_return" | "returned" | "cancelled" | "shipped" | null {
  const x = norm(v);
  if (!x) return null;
  if (x === "delivered" || x.includes("delivered_successfully")) return "delivered";
  if (x === "partial" || x.startsWith("partial_") || x.includes("partially_delivered") || x.includes("partially_cancelled")) return "partial";
  if (x === "in_review" || x.includes("in_review") || x.includes("unreview")) return "shipped";
  if (x.includes("cancellation_request") || x.includes("cancel_request") || x.includes("cancellation_pending") || x.includes("cancel_pending") || x.includes("return_pending") || x.includes("return_process") || x === "pending_return") return "pending_return";
  if (x === "returned" || x === "return" || x === "rto" || x.startsWith("return_") || x.startsWith("rto_") || x.includes("reversed_back") || x.includes("return_to_sender") || x.includes("returned_to_sender") || x.includes("return_to_merchant")) return "returned";
  if (x === "cancelled" || x === "canceled" || x.startsWith("cancelled_") || x.startsWith("canceled_")) return "cancelled";
  return "shipped";
}

async function call(c: string, cfg: R) {
  const base = s(cfg.base_url) || "https://portal.packzy.com/api/v1";
  const ak = s(cfg.api_key), sk = s(cfg.secret_key);
  if (!ak || !sk) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(
        `${base.replace(/\/$/, "")}/status_by_cid/${encodeURIComponent(c)}`,
        {
          headers: { "Api-Key": ak, "Secret-Key": sk, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (r.ok) {
        const p = await r.json().catch(() => null) as R | null;
        return s(p?.delivery_status ?? p?.status_text) || null;
      }
      if (r.status !== 408 && r.status !== 429 && r.status < 500) return null;
    } catch {}
    if (attempt === 0) await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function recordFailure(a: ReturnType<typeof createClient>, orderId: string, consignment: string, errorText: string) {
  const { data: old } = await a.from("steadfast_sync_failures")
    .select("attempts").eq("order_id", orderId).maybeSingle();
  const attempts = Number(old?.attempts ?? 0) + 1;
  const delay = Math.min(12 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, 5 * 60 * 1000 * Math.pow(2, Math.min(attempts - 1, 7))));
  const now = new Date();
  await a.from("steadfast_sync_failures").upsert({
    order_id: orderId,
    courier_consignment: consignment,
    error_text: errorText.slice(0, 500),
    attempts,
    last_failed_at: now.toISOString(),
    next_retry_at: new Date(now.getTime() + delay).toISOString(),
    resolved_at: null,
  });
}

async function syncOne(a: ReturnType<typeof createClient>, o: R, byDisplay: Map<string, R>, cfgs: {cfg:R}[]) {
  const id = s(o.id), consignment = s(o.courier_consignment);
  if (!id || !consignment) return { ok: true, updated: false, skipped: true };

  let cfg = byDisplay.get(s(o.courier_display_name));
  let cs: string | null = null;

  if (cfg) {
    cs = await call(consignment, cfg);
  } else if (!s(o.courier_display_name)) {
    for (const x of cfgs) {
      cs = await call(consignment, x.cfg);
      if (cs) break;
    }
  } else {
    return { ok: true, updated: false, skipped: true };
  }

  if (!cs) {
    await recordFailure(a, id, consignment, "courier_status_unavailable");
    return { ok: false, updated: false, skipped: false };
  }

  const m = map(cs);
  if (!m) {
    await recordFailure(a, id, consignment, "unrecognized_courier_status");
    return { ok: false, updated: false, skipped: false };
  }

  const courierChanged = s(o.courier_status) !== cs;
  const businessStatusChanged = m !== s(o.status);

  // Unchanged status = absolutely no order patch and no courier_synced_at change.
  if (!courierChanged && !businessStatusChanged) {
    return { ok: true, updated: false, skipped: false };
  }

  const stamp = new Date().toISOString();
  const patch: R = { courier_status: cs, courier_synced_at: stamp, updated_at: stamp };
  if (businessStatusChanged) patch.status = m;

  const { error: e } = await a.from("orders").update(patch).eq("id", id);
  if (e) {
    await recordFailure(a, id, consignment, "order_update_failed");
    return { ok: false, updated: false, skipped: false };
  }
  return { ok: true, updated: true, skipped: false };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const u = Deno.env.get("SUPABASE_URL");
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!u || !k) return json({ error: "Server configuration missing" }, 500);

  const a = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } });

  const supplied = req.headers.get("x-courier-sync-secret") ?? "";
  const { data: sr } = await a.from("system_job_secrets")
    .select("secret").eq("name", "steadfast_status_sync").maybeSingle();
  if (!sr?.secret || supplied !== sr.secret) return json({ error: "Unauthorized" }, 401);

  const { data: ints, error: ie } = await a.from("integrations")
    .select("name,config").eq("is_active", true)
    .in("name", ["all_api_steadfast", "all_api_steadfast_2"]);
  if (ie) return json({ error: ie.message }, 500);

  const cfgs = (ints ?? [])
    .map((r: R) => ({ name: s(r.name), cfg: (r.config ?? {}) as R }))
    .filter((x) => s(x.cfg.api_key) && s(x.cfg.secret_key));
  const byDisplay = new Map(cfgs.map((x) => [s(x.cfg.display_name), x.cfg]));

  const { data: cursor, error: ce } = await a.from("steadfast_sync_cursor")
    .select("name,last_id,cycle_started_at,cycle_completed_at,locked_until,lock_token")
    .eq("name", "steadfast_status_sync").maybeSingle();
  if (ce) return json({ error: ce.message }, 500);

  const now = new Date();
  const nowIso = now.toISOString();

  // Atomic short lease prevents overlapping cron invocations from sharing the cursor.
  const lockToken = crypto.randomUUID();
  const lockUntil = new Date(now.getTime() + LOCK_MS).toISOString();
  const { data: claimed, error: le } = await a.from("steadfast_sync_cursor")
    .update({ locked_until: lockUntil, lock_token: lockToken, updated_at: nowIso })
    .eq("name", "steadfast_status_sync")
    .or(`locked_until.is.null,locked_until.lt.${nowIso}`)
    .select("lock_token").maybeSingle();
  if (le) return json({ error: le.message }, 500);
  if (!claimed?.lock_token) return json({ status: "locked", selected: 0, checked: 0, updated: 0, failed: 0, skipped: 0 });

  try {
    const completedAt = cursor?.cycle_completed_at ? new Date(cursor.cycle_completed_at) : null;
    const inCooldown = Boolean(completedAt && now.getTime() - completedAt.getTime() < COOLDOWN_MS);

    // Failed orders are persisted and retried independently even during the 12-hour cooldown.
    const { data: retryRows } = await a.from("steadfast_sync_failures")
      .select("order_id").is("resolved_at", null).lte("next_retry_at", nowIso)
      .order("next_retry_at", { ascending: true }).limit(RETRY_BATCH);

    let retryChecked = 0, retryUpdated = 0, retryFailed = 0;
    const retryIds = (retryRows ?? []).map((x: R) => s(x.order_id)).filter(Boolean);
    const resolvedRetryIds: string[] = [];

    if (retryIds.length) {
      const { data: retryOrders } = await a.from("orders")
        .select("id,status,courier_consignment,courier_display_name,courier_status,courier_synced_at")
        .in("id", retryIds);
      for (const o of retryOrders ?? []) {
        retryChecked++;
        const r = await syncOne(a, o as R, byDisplay, cfgs);
        if (r.updated) retryUpdated++;
        if (!r.ok) retryFailed++;
        if (r.ok && !r.skipped) resolvedRetryIds.push(s((o as R).id));
      }

      // Resolve only retry records that were actually due, in batches. This
      // replaces thousands of empty DELETE requests from normal status checks.
      for (let i = 0; i < resolvedRetryIds.length; i += 100) {
        await a.from("steadfast_sync_failures")
          .delete()
          .in("order_id", resolvedRetryIds.slice(i, i + 100));
      }
    }

    if (inCooldown) {
      return json({
        status: retryIds.length ? "cooldown_retry" : "cooldown",
        next_sync_at: new Date(completedAt!.getTime() + COOLDOWN_MS).toISOString(),
        selected: 0, checked: retryChecked, updated: retryUpdated,
        failed: retryFailed, skipped: 0, retry_pending: retryIds.length,
      });
    }

    const resetCycle = !cursor?.cycle_started_at || Boolean(completedAt);
    const cycleStartedAt = resetCycle ? nowIso : cursor!.cycle_started_at;
    const lastId = resetCycle ? null : s(cursor?.last_id) || null;

    let query = a.from("orders")
      .select("id,status,courier_consignment,courier_display_name,courier_status,courier_synced_at")
      .not("courier_consignment", "is", null)
      .or("courier_status.is.null,courier_status.not.in.(delivered,cancelled,partial_delivered)")
      .order("id", { ascending: true }).limit(PAGE_SIZE);
    if (lastId) query = query.gt("id", lastId);

    const { data: orders, error } = await query;
    if (error) return json({ error: error.message }, 500);

    let checked = retryChecked, updated = retryUpdated, failed = retryFailed, skipped = 0;

    for (let i = 0; i < orders.length; i += 10) {
      const rs = await Promise.all(orders.slice(i, i + 10).map((o) => syncOne(a, o as R, byDisplay, cfgs)));
      checked += rs.length;
      updated += rs.filter((x) => x.updated).length;
      failed += rs.filter((x) => !x.ok).length;
      skipped += rs.filter((x) => x.skipped).length;
    }

    const reachedEnd = orders.length < PAGE_SIZE;
    const nextCursor = orders.length ? orders[orders.length - 1].id : lastId;

    const updatePayload: R = {
      last_id: reachedEnd ? null : nextCursor,
      cycle_started_at: cycleStartedAt,
      cycle_completed_at: reachedEnd ? nowIso : null,
      updated_at: nowIso,
    };

    const { error: ue } = await a.from("steadfast_sync_cursor")
      .update(updatePayload).eq("name", "steadfast_status_sync");
    if (ue) return json({ error: ue.message }, 500);

    return json({
      status: "success",
      cycle: reachedEnd ? "completed" : "in_progress",
      selected: orders.length,
      checked, updated, failed, skipped,
      retry_pending: retryIds.length,
    });
  } finally {
    await a.from("steadfast_sync_cursor")
      .update({ locked_until: null, lock_token: null, updated_at: new Date().toISOString() })
      .eq("name", "steadfast_status_sync").eq("lock_token", lockToken);
  }
});