// Server-only: the single place where an AI reply is produced and sent.
//
// Duplicate replies used to happen because three independent paths (Meta
// webhook, the scheduled autopilot, and the admin panel's auto-sync poll)
// could all look at the same unanswered message at the same time. Everything
// now goes through here, and every reply must first *claim* its trigger row
// atomically — so one customer message can only ever produce one reply.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import {
  buildTrainingPrompt,
  type FbPageConfig,
  loadFbPageConfig,
  privateReplyToComment,
  replyToComment,
  sendMessengerText,
} from "@/lib/fb-page.server";
import { generateAiReply } from "@/lib/fb-ai.server";

const db = supabaseAdmin as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/** Cross-process run lock so two background passes never overlap. */
export async function acquireLock(key: string, seconds = 90): Promise<boolean> {
  const { data, error } = await db.rpc("try_fb_lock", { _key: key, _seconds: seconds });
  if (error) return true; // never block the pipeline on lock bookkeeping
  return data === true;
}

export async function releaseLock(key: string): Promise<void> {
  await db.rpc("release_fb_lock", { _key: key });
}

export async function withLock<T>(key: string, seconds: number, run: () => Promise<T>): Promise<T | null> {
  if (!(await acquireLock(key, seconds))) return null;
  try {
    return await run();
  } finally {
    await releaseLock(key);
  }
}

type MessageRow = {
  id: string;
  direction: "in" | "out";
  text: string | null;
  ai_handled: boolean;
};

/** Atomically take ownership of an incoming message. Returns false if someone else already has it. */
async function claimMessage(id: string): Promise<boolean> {
  const { data } = await db
    .from("fb_messages")
    .update({ ai_handled: true })
    .eq("id", id)
    .eq("ai_handled", false)
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

async function unclaimMessage(id: string): Promise<void> {
  await db.from("fb_messages").update({ ai_handled: false }).eq("id", id);
}

export type ReplyOutcome =
  | { status: "replied"; text: string; needsHuman: boolean; orderId?: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/**
 * Reply to the newest customer message of one conversation.
 * Safe to call concurrently from any number of workers.
 */
export async function replyToConversation(
  cfg: FbPageConfig,
  conv: { id: string; psid: string },
): Promise<ReplyOutcome> {
  const { data: history } = await db
    .from("fb_messages")
    .select("id,direction,text,ai_handled,created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = [...((history ?? []) as MessageRow[])].reverse();
  const last = rows[rows.length - 1];
  if (!last) return { status: "skipped", reason: "no_messages" };
  if (last.direction !== "in") return { status: "skipped", reason: "already_answered" };
  if (!last.text) return { status: "skipped", reason: "attachment_only" };
  if (last.ai_handled) return { status: "skipped", reason: "already_handled" };

  if (!(await claimMessage(last.id))) return { status: "skipped", reason: "claimed_elsewhere" };

  // Any older unanswered customer lines are folded into this one reply.
  const stale = rows.filter((row) => row.direction === "in" && !row.ai_handled && row.id !== last.id);
  if (stale.length) {
    await db.from("fb_messages").update({ ai_handled: true }).in("id", stale.map((row) => row.id));
  }

  try {
    // If this customer already has a fresh order, tell the AI so it never
    // re-creates it or sends a second confirmation.
    const { data: convRow } = await db
      .from("fb_conversations")
      .select("last_order_id")
      .eq("id", conv.id)
      .maybeSingle();
    let existingOrder: { invoice_no: string | null; total: number } | null = null;
    if (convRow?.last_order_id) {
      const { data: ord } = await db
        .from("orders")
        .select("invoice_no,total,created_at,deleted_at")
        .eq("id", convRow.last_order_id)
        .maybeSingle();
      if (ord && !ord.deleted_at && Date.now() - new Date(ord.created_at).getTime() < 12 * 60 * 60 * 1000) {
        existingOrder = { invoice_no: ord.invoice_no, total: Number(ord.total) };
      }
    }

    const reply = await generateAiReply({
      history: rows.slice(0, -1).map((row) => ({ direction: row.direction, text: row.text })),
      incoming: last.text,
      allowOrders: cfg.auto_order,
      channel: "messenger",
      extraPrompt: buildTrainingPrompt(cfg),
      existingOrder,
    });

    if (!reply.text) {
      await db.from("fb_conversations").update({ needs_human: true }).eq("id", conv.id);
      return { status: "skipped", reason: "empty_reply" };
    }

    const sent = (await sendMessengerText(cfg, conv.psid, reply.text)) as { message_id?: string };
    // Store Facebook's own message id so the next page sync recognises this
    // outgoing message instead of inserting it a second time.
    await db.from("fb_messages").insert({
      conversation_id: conv.id,
      direction: "out",
      text: reply.text,
      mid: sent?.message_id ?? null,
      sent_by: "ai",
      ai_handled: true,
    });
    await db
      .from("fb_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_text: reply.text,
        needs_human: reply.needsHuman,
        status: "open",
        ...(reply.orderId ? { last_order_id: reply.orderId } : {}),
      })
      .eq("id", conv.id);

    return { status: "replied", text: reply.text, needsHuman: reply.needsHuman, orderId: reply.orderId };
  } catch (err) {
    // Release the claim so the next pass can retry this message.
    await unclaimMessage(last.id);
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[fb-reply] message reply failed:", reason);
    return { status: "failed", reason };
  }
}

export type BacklogResult = {
  scanned: number;
  replied: number;
  skipped: number;
  failed: number;
  errors: string[];
};

/** Answer every conversation whose newest message is an unhandled customer message. */
export async function replyToPendingConversations(
  options: { limit?: number; since?: string | null; cfg?: FbPageConfig | null } = {},
): Promise<BacklogResult> {
  const cfg = options.cfg ?? (await loadFbPageConfig(true));
  if (!cfg?.page_access_token) throw new Error("Facebook Page কানেক্ট করা নেই");

  const result: BacklogResult = { scanned: 0, replied: 0, skipped: 0, failed: 0, errors: [] };
  if (!cfg.ai_enabled) return result;

  let query = db
    .from("fb_conversations")
    .select("id,psid,customer_name,last_message_at")
    .eq("page_id", cfg.page_id);
  if (options.since) query = query.gte("last_message_at", options.since);
  const { data: convs, error } = await query
    .order("last_message_at", { ascending: false })
    .limit(Math.min(options.limit ?? 25, 100));
  if (error) throw new Error((error as { message: string }).message);

  for (const conv of (convs ?? []) as { id: string; psid: string; customer_name: string | null }[]) {
    result.scanned += 1;
    const outcome = await replyToConversation(cfg, conv);
    if (outcome.status === "replied") result.replied += 1;
    else if (outcome.status === "failed") {
      result.failed += 1;
      if (result.errors.length < 3) {
        result.errors.push(`${conv.customer_name ?? conv.psid}: ${outcome.reason.slice(0, 140)}`);
      }
    } else result.skipped += 1;
  }

  return result;
}

type CommentRow = {
  id: string;
  comment_id: string;
  text: string | null;
  from_id: string | null;
  from_name: string | null;
  parent_comment_id: string | null;
};

/** Atomically claim a comment by flipping `replied` before we call the AI. */
async function claimComment(id: string): Promise<boolean> {
  const { data } = await db
    .from("fb_comments")
    .update({ replied: true })
    .eq("id", id)
    .eq("replied", false)
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

/** Public + private reply to one comment. Assumes the row is already claimed. */
async function answerComment(cfg: FbPageConfig, row: CommentRow): Promise<boolean> {
  try {
    const reply = await generateAiReply({
      history: [],
      incoming: row.text ?? "",
      allowOrders: false,
      channel: "comment",
      extraPrompt: buildTrainingPrompt(cfg),
    });
    if (!reply.text) throw new Error("AI reply empty");

    const name = row.from_name?.split(" ")[0];
    const publicText = name ? `${name}, ${reply.text}` : reply.text;
    await replyToComment(cfg, row.comment_id, publicText);

    let privateOk = false;
    if (cfg.private_reply) {
      try {
        await privateReplyToComment(cfg, row.comment_id, reply.text);
        privateOk = true;
      } catch (err) {
        // Private replies only work within Meta's 7-day window — not fatal.
        console.warn("[fb-reply] private reply skipped:", err);
      }
    }

    await db
      .from("fb_comments")
      .update({ ai_reply: reply.text, replied: true, private_replied: privateOk, reply_error: null })
      .eq("id", row.id);
    return true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[fb-reply] comment reply failed:", reason);
    const permanent = /already|does not exist|Unsupported|deleted|invalid/i.test(reason);
    await db
      .from("fb_comments")
      // Permanent errors stay claimed (never retried); transient ones are released.
      .update({ replied: permanent, reply_error: reason.slice(0, 300) })
      .eq("id", row.id);
    return false;
  }
}

/** Answer every stored comment that has not been replied to yet. */
export async function replyToPendingComments(
  options: { limit?: number; since?: string | null; cfg?: FbPageConfig | null } = {},
): Promise<{ replied: number; failed: number; skipped: number }> {
  const cfg = options.cfg ?? (await loadFbPageConfig(true));
  if (!cfg?.page_access_token) throw new Error("Facebook Page কানেক্ট করা নেই");
  const out = { replied: 0, failed: 0, skipped: 0 };
  if (!cfg.reply_comments || !cfg.ai_enabled) return out;

  let query = db
    .from("fb_comments")
    .select("id,comment_id,text,from_id,from_name,parent_comment_id")
    .eq("page_id", cfg.page_id)
    .eq("replied", false);
  if (options.since) query = query.gte("created_at", options.since);
  const { data: rows } = await query
    .order("created_at", { ascending: true })
    .limit(Math.min(options.limit ?? 25, 100));

  for (const row of (rows ?? []) as CommentRow[]) {
    // Never answer ourselves, and never answer an empty/sticker-only comment.
    if (!row.text?.trim() || row.from_id === cfg.page_id) {
      await db.from("fb_comments").update({ replied: true }).eq("id", row.id);
      out.skipped += 1;
      continue;
    }
    if (!(await claimComment(row.id))) {
      out.skipped += 1;
      continue;
    }
    if (await answerComment(cfg, row)) out.replied += 1;
    else out.failed += 1;
  }

  return out;
}

/** Reply to a single comment that just arrived by webhook. */
export async function replyToCommentById(cfg: FbPageConfig, rowId: string): Promise<boolean> {
  if (!cfg.reply_comments || !cfg.ai_enabled) return false;
  const { data } = await db
    .from("fb_comments")
    .select("id,comment_id,text,from_id,from_name,parent_comment_id")
    .eq("id", rowId)
    .maybeSingle();
  const row = data as CommentRow | null;
  if (!row?.text?.trim() || row.from_id === cfg.page_id) return false;
  if (!(await claimComment(row.id))) return false;
  return answerComment(cfg, row);
}
