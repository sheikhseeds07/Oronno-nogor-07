import { logger } from "@/lib/logger";
// Server-only webhook payload handling: persist messages and comments for staff.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { type FbPageConfig, fetchProfileName } from "@/lib/fb-page.server";


type Conversation = {
  id: string;
  ai_enabled: boolean;
  ai_paused_until: string | null;
  status: string;
  customer_name: string | null;
};

async function getOrCreateConversation(cfg: FbPageConfig, psid: string): Promise<Conversation> {
  const { data: existing } = await supabaseAdmin
    .from("fb_conversations")
    .select("id,ai_enabled,ai_paused_until,status,customer_name")
    .eq("page_id", cfg.page_id)
    .eq("psid", psid)
    .maybeSingle();
  if (existing) return existing as Conversation;

  const name = await fetchProfileName(cfg, psid);
  const { data, error } = await supabaseAdmin
    .from("fb_conversations")
    .insert({ page_id: cfg.page_id, psid, customer_name: name })
    .select("id,ai_enabled,ai_paused_until,status,customer_name")
    .single();
  if (error || !data) throw new Error(error?.message ?? "conversation create failed");
  return data as Conversation;
}

async function logMessage(row: {
  conversation_id: string;
  direction: "in" | "out";
  text: string | null;
  mid?: string | null;
  sent_by?: string | null;
  attachments?: unknown[];
}) {
  await supabaseAdmin.from("fb_messages").insert({
    conversation_id: row.conversation_id,
    direction: row.direction,
    text: row.text,
    mid: row.mid ?? null,
    sent_by: row.sent_by ?? null,
    attachments: (row.attachments ?? []) as never,
  });
}

async function handleMessagingEvent(cfg: FbPageConfig, event: Record<string, any>) {
  const psid: string | undefined = event?.sender?.id;
  const message = event?.message;
  if (!psid || !message) return;

  const text: string | null = typeof message.text === "string" ? message.text : null;
  const attachments: unknown[] = Array.isArray(message.attachments) ? message.attachments : [];
  if (!text && !attachments.length) return;

  const echoPsid: string | undefined = message.is_echo ? event?.recipient?.id : psid;
  if (!echoPsid) return;
  const conv = await getOrCreateConversation(cfg, echoPsid);

  // Deduplicate on Facebook message id.
  if (message.mid) {
    const { data: dupe } = await supabaseAdmin
      .from("fb_messages")
      .select("id")
      .eq("mid", message.mid)
      .maybeSingle();
    if (dupe) return;
  }

  if (message.is_echo) {
    await logMessage({ conversation_id: conv.id, direction: "out", text, mid: message.mid, attachments, sent_by: "page" });
    await supabaseAdmin.from("fb_conversations").update({ last_message_at: new Date().toISOString(), last_message_text: text ?? "[attachment]" }).eq("id", conv.id);
    return;
  }
  await logMessage({ conversation_id: conv.id, direction: "in", text, mid: message.mid, attachments });
  const { data: counted } = await supabaseAdmin
    .from("fb_conversations")
    .select("unread_count")
    .eq("id", conv.id)
    .maybeSingle();
  await supabaseAdmin
    .from("fb_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_text: text ?? "[attachment]",
      unread_count: (counted?.unread_count ?? 0) + 1,
      status: "open",
      ai_enabled: true,
      ai_paused_until: null,
      needs_human: false,
    })
    .eq("id", conv.id);

}

async function handleFeedChange(cfg: FbPageConfig, value: Record<string, any>) {
  if (value?.item !== "comment") return;
  const commentId: string | undefined = value.comment_id;
  if (!commentId) return;
  if (value?.verb === "remove" || value?.verb === "hide") {
    await supabaseAdmin.from("fb_comments").delete().eq("comment_id", commentId);
    return;
  }
  if (value.verb !== "add") return;
  if (value?.from?.id && value.from.id === cfg.page_id) return; // ignore our own comments

  const { data: dupe } = await supabaseAdmin
    .from("fb_comments")
    .select("id")
    .eq("comment_id", commentId)
    .maybeSingle();
  if (dupe) return; // already stored (and therefore already claimed/answered)

  const text: string = typeof value.message === "string" ? value.message : "";
  await supabaseAdmin
    .from("fb_comments")
    .insert({
      page_id: cfg.page_id,
      post_id: value.post_id ?? null,
      comment_id: commentId,
      parent_comment_id: value.parent_id ?? null,
      from_id: value.from?.id ?? null,
      from_name: value.from?.name ?? null,
      text: text || null,
      permalink: value.permalink_url ?? null,
    })
    .select("id")
    .single();
}


export async function handleFbWebhookPayload(cfg: FbPageConfig, payload: Record<string, any>) {
  const entries: Record<string, any>[] = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    if (entry?.id && entry.id !== cfg.page_id) continue;
    for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) {
      try {
        await handleMessagingEvent(cfg, event);
      } catch (err) {
        logger.error("[fb-inbox] messaging event failed", err);
      }
    }
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      if (change?.field !== "feed") continue;
      try {
        await handleFeedChange(cfg, change.value ?? {});
      } catch (err) {
        logger.error("[fb-inbox] feed change failed", err);
      }
    }
  }
}
