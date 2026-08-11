// Server-only autopilot: pulls new Facebook messages/comments and lets the AI
// answer everything unanswered — runs on a schedule, no manual click needed.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { loadFbPageConfig } from "@/lib/fb-page.server";
import { syncFacebookHistory } from "@/lib/fb-sync.server";
import { replyToPendingComments, replyToPendingConversations, withLock } from "@/lib/fb-reply.server";

/** Reply with AI to every stored comment that has no reply yet. */
export async function aiReplyCommentBacklog(limit = 25, since?: string | null) {
  return replyToPendingComments({ limit, since });
}

/**
 * The moment autopilot became active. Anything older than this is treated as
 * history, so re-synced old threads never get an automatic reply.
 */
export async function autopilotSince(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("name", "facebook_page")
    .maybeSingle();
  const config = (data?.config as Record<string, unknown> | null) ?? {};
  const existing = typeof config.autopilot_since === "string" ? config.autopilot_since : null;
  if (existing) return existing;
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("integrations")
    .update({ config: { ...config, autopilot_since: now } })
    .eq("name", "facebook_page");
  return now;
}

export async function runFbAutopilot() {
  // Renew the Page/user token long before Meta expires it (no manual reconnect).
  const { keepFbTokenFresh } = await import("@/lib/fb-page.server");
  await keepFbTokenFresh();
  const cfg = await loadFbPageConfig(true);
  if (!cfg?.page_id || !cfg.page_access_token) return { ok: false as const, reason: "not_connected" as const };


  // Only one autopilot pass may run at a time across every caller (cron,
  // admin panel poll, webhook fallback) — otherwise the same message could be
  // picked up twice before the first reply lands.
  const result = await withLock("fb_autopilot", 100, async () => {
    const out = { ok: true as const, messages: 0, comments: 0, replied_messages: 0, replied_comments: 0, deep: false };

    // Every ~10 minutes do a deep pass: full history sync + bigger reply batch.
    // This is the safety net that guarantees nothing stays unanswered even if a
    // webhook was dropped or a fast pass hit its batch limit.
    const deep = new Date().getUTCMinutes() % 10 === 0;
    out.deep = deep;

    try {
      const stats = await syncFacebookHistory(cfg, { fast: !deep });
      out.messages = stats.messages;
      out.comments = stats.comments;
    } catch (err) {
      console.warn("[fb-autopilot] sync failed", err);
    }

    const since = await autopilotSince();
    const limit = deep ? 100 : 25;
    const [messages, comments] = await Promise.all([
      replyToPendingConversations({ limit, since, cfg }).catch((err) => {
        console.warn("[fb-autopilot] message reply failed", err);
        return { replied: 0 };
      }),
      replyToPendingComments({ limit, since, cfg }).catch((err) => {
        console.warn("[fb-autopilot] comment reply failed", err);
        return { replied: 0 };
      }),
    ]);
    out.replied_messages = messages.replied;
    out.replied_comments = comments.replied;
    return out;
  });


  return result ?? { ok: true as const, skipped: "already_running" as const };
}
