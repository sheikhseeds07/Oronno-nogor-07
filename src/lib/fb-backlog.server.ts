// Server-only: thin wrappers kept for existing call sites. All reply logic and
// duplicate protection lives in fb-reply.server.ts (single source of truth).
import { loadFbPageConfig } from "@/lib/fb-page.server";
import {
  type BacklogResult,
  replyToConversation,
  replyToPendingConversations,
} from "@/lib/fb-reply.server";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

export type { BacklogResult };

export async function aiReplyToConversation(conversationId: string) {
  const cfg = await loadFbPageConfig(true);
  if (!cfg?.page_access_token) throw new Error("Facebook Page কানেক্ট করা নেই");

  const { data: conv } = await supabaseAdmin
    .from("fb_conversations")
    .select("id,psid")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) throw new Error("Conversation পাওয়া যায়নি");

  const outcome = await replyToConversation(cfg, conv);
  if (outcome.status === "replied") {
    return { text: outcome.text, needsHuman: outcome.needsHuman, orderId: outcome.orderId };
  }
  if (outcome.status === "failed") throw new Error(outcome.reason);
  return { text: null, needsHuman: false, orderId: null, skipped: outcome.reason };
}

export async function aiReplyBacklog(limit = 25, since?: string | null): Promise<BacklogResult> {
  return replyToPendingConversations({ limit, since });
}
