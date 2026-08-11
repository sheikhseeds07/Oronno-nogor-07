import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function guard(userId: string) {
  const { assertIsStaff } = await import("@/lib/_admin-guard.server");
  await assertIsStaff(userId);
}

export const listFbConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ status: z.enum(["all", "open", "human", "closed"]).default("all") }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    let query = supabaseAdmin
      .from("fb_conversations")
      .select("id,psid,customer_name,customer_phone,last_message_at,last_message_text,unread_count,ai_enabled,status,needs_human,last_order_id")
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listFbMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("fb_messages")
      .select("id,direction,text,sent_by,created_at,attachments")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("fb_conversations").update({ unread_count: 0 }).eq("id", data.conversation_id);
    return rows ?? [];
  });

export const sendFbReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ conversation_id: z.string().uuid(), text: z.string().min(1).max(1900) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { loadFbPageConfig, sendMessengerText } = await import("@/lib/fb-page.server");

    const cfg = await loadFbPageConfig(true);
    if (!cfg?.page_access_token) throw new Error("Facebook Page কানেক্ট করা নেই");

    const { data: conv } = await supabaseAdmin
      .from("fb_conversations")
      .select("psid")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("Conversation পাওয়া যায়নি");

    await sendMessengerText(cfg, conv.psid, data.text);
    await supabaseAdmin.from("fb_messages").insert({
      conversation_id: data.conversation_id,
      direction: "out",
      text: data.text,
      sent_by: "staff",
      staff_id: context.userId,
    });
    // Staff replied -> pause AI for 30 minutes so it doesn't talk over them.
    await supabaseAdmin
      .from("fb_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_text: data.text,
        ai_paused_until: new Date(Date.now() + 30 * 60_000).toISOString(),
        needs_human: false,
      })
      .eq("id", data.conversation_id);
    return { ok: true };
  });

export const updateFbConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        ai_enabled: z.boolean().optional(),
        status: z.enum(["open", "human", "closed"]).optional(),
        needs_human: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { conversation_id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("fb_conversations")
      .update({ ...patch, ...(patch.ai_enabled ? { ai_paused_until: null } : {}) })
      .eq("id", conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enableAiEverywhere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("fb_conversations")
      .update({ ai_enabled: true, ai_paused_until: null, status: "open", needs_human: false })
      .neq("status", "closed")
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, updated: rows?.length ?? 0 };
  });


export const listFbComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("fb_comments")
      .select("id,comment_id,from_name,text,ai_reply,replied,private_replied,reply_error,permalink,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const replyFbComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), text: z.string().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { loadFbPageConfig, replyToComment } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.page_access_token) throw new Error("Facebook Page কানেক্ট করা নেই");

    const { data: row } = await supabaseAdmin
      .from("fb_comments")
      .select("comment_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("কমেন্ট পাওয়া যায়নি");

    await replyToComment(cfg, row.comment_id, data.text);
    await supabaseAdmin.from("fb_comments").update({ replied: true, ai_reply: data.text }).eq("id", data.id);
    return { ok: true };
  });

export const testFbPageConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { loadFbPageConfig } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.page_access_token || !cfg.page_id) return { ok: false, message: "Page ID / Access Token দিন" };
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${cfg.page_id}?fields=name,username&access_token=${encodeURIComponent(cfg.page_access_token)}`,
    );
    const body = await res.text();
    if (!res.ok) return { ok: false, message: `ব্যর্থ [${res.status}]: ${body.slice(0, 200)}` };
    const json = JSON.parse(body) as { name?: string };
    return { ok: true, message: `কানেক্টেড: ${json.name ?? cfg.page_id}` };
  });

/** Delete selected messages here AND unsend them from the Facebook page. */
export const deleteFbMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { loadFbPageConfig } = await import("@/lib/fb-page.server");

    const { data: rows, error } = await supabaseAdmin
      .from("fb_messages")
      .select("id,mid")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    const cfg = await loadFbPageConfig(true);
    let removedOnFacebook = 0;
    const failed: string[] = [];

    if (cfg?.page_access_token) {
      for (const row of rows ?? []) {
        if (!row.mid) continue;
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(row.mid)}?access_token=${encodeURIComponent(cfg.page_access_token)}`,
            { method: "DELETE" },
          );
          if (res.ok) removedOnFacebook += 1;
          else failed.push((await res.text()).slice(0, 120));
        } catch (e) {
          failed.push(e instanceof Error ? e.message : String(e));
        }
      }
    }

    const { error: delError } = await supabaseAdmin.from("fb_messages").delete().in("id", data.ids);
    if (delError) throw new Error(delError.message);

    return {
      ok: true,
      deleted: data.ids.length,
      removedOnFacebook,
      warning: failed.length
        ? `${failed.length}টি মেসেজ Facebook থেকে মুছা যায়নি (শুধু পেইজের পাঠানো মেসেজ unsend করা যায়)।`
        : null,
    };
  });
