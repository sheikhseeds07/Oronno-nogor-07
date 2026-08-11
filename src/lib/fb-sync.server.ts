import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { refreshFbPageAccessToken, type FbPageConfig } from "@/lib/fb-page.server";

const GRAPH = "https://graph.facebook.com/v21.0";

type GraphPage<T> = { data?: T[]; paging?: { next?: string } };

async function graphPage<T>(url: string, cfg: FbPageConfig, retried = false): Promise<GraphPage<T>> {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok && !retried && /"code"\s*:\s*190/.test(text)) {
    const refreshed = await refreshFbPageAccessToken(cfg.page_id);
    if (refreshed) {
      cfg.page_access_token = refreshed;
      const retryUrl = new URL(url);
      retryUrl.searchParams.set("access_token", refreshed);
      return graphPage<T>(retryUrl.toString(), cfg, true);
    }
  }
  if (!response.ok) throw new Error(`Facebook sync ব্যর্থ [${response.status}]: ${text.slice(0, 240)}`);
  return JSON.parse(text) as GraphPage<T>;
}

async function conversationId(cfg: FbPageConfig, psid: string, name?: string | null) {
  const { data, error } = await supabaseAdmin
    .from("fb_conversations")
    .upsert(
      { page_id: cfg.page_id, psid, ...(name ? { customer_name: name } : {}) },
      { onConflict: "page_id,psid", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Conversation sync ব্যর্থ");
  return data.id;
}

async function syncMessages(cfg: FbPageConfig, fast = false) {
  const convLimit = fast ? 6 : 50;
  const msgLimit = fast ? 12 : 100;
  const maxConvPages = fast ? 1 : 20;
  const maxMsgPages = fast ? 1 : 20;
  let url: string | undefined = `${GRAPH}/${cfg.page_id}/conversations?limit=${convLimit}&fields=id,participants,updated_time&access_token=${encodeURIComponent(cfg.page_access_token)}`;
  let conversations = 0;
  let messages = 0;
  for (let page = 0; url && page < maxConvPages; page += 1) {
    const result: GraphPage<{ id: string; participants?: { data?: { id: string; name?: string }[] }; updated_time?: string }> = await graphPage(url, cfg);
    await Promise.all((result.data ?? []).map(async (item) => {
      const customer = item.participants?.data?.find((person) => person.id !== cfg.page_id);
      if (!customer?.id) return;
      const id = await conversationId(cfg, customer.id, customer.name);
      conversations += 1;
      let messageUrl: string | undefined = `${GRAPH}/${item.id}/messages?limit=${msgLimit}&fields=id,message,from,to,created_time,attachments&access_token=${encodeURIComponent(cfg.page_access_token)}`;
      let lastText: string | null = null;
      let lastAt = item.updated_time ?? new Date().toISOString();
      for (let messagePage = 0; messageUrl && messagePage < maxMsgPages; messagePage += 1) {
        const messageResult: GraphPage<{ id: string; message?: string; from?: { id?: string }; created_time?: string; attachments?: { data?: unknown[] } }> = await graphPage(messageUrl, cfg);
        for (const message of messageResult.data ?? []) {
          const direction = message.from?.id === cfg.page_id ? "out" : "in";
          const { error } = await supabaseAdmin.from("fb_messages").upsert(
            {
              conversation_id: id,
              direction,
              text: message.message ?? null,
              mid: message.id,
              sent_by: direction === "out" ? "page" : null,
              attachments: (message.attachments?.data ?? []) as never,
              created_at: message.created_time ?? new Date().toISOString(),
            },
            { onConflict: "mid", ignoreDuplicates: true },
          );
          if (error) throw new Error(error.message);
          messages += 1;
          if (!lastText || (message.created_time && message.created_time > lastAt)) {
            lastText = message.message ?? "[attachment]";
            lastAt = message.created_time ?? lastAt;
          }
        }
        messageUrl = messageResult.paging?.next;
      }
      await supabaseAdmin.from("fb_conversations").update({ last_message_at: lastAt, last_message_text: lastText }).eq("id", id);
    }));
    url = result.paging?.next;
  }
  return { conversations, messages };
}

async function syncComments(cfg: FbPageConfig, fast = false) {
  const feedLimit = fast ? 5 : 50;
  const commentLimit = fast ? 12 : 100;
  const maxPages = fast ? 1 : 20;
  let url: string | undefined = `${GRAPH}/${cfg.page_id}/feed?limit=${feedLimit}&fields=id,comments.limit(${commentLimit}){id,message,from,parent,created_time,permalink_url}&access_token=${encodeURIComponent(cfg.page_access_token)}`;
  let comments = 0;
  for (let page = 0; url && page < maxPages; page += 1) {
    const result: GraphPage<{ id: string; comments?: GraphPage<{ id: string; message?: string; from?: { id?: string; name?: string }; parent?: { id?: string }; created_time?: string; permalink_url?: string }> }> = await graphPage(url, cfg);
    for (const post of result.data ?? []) {
      for (const comment of post.comments?.data ?? []) {
        if (!comment.id || comment.from?.id === cfg.page_id) continue;
        const { error } = await supabaseAdmin.from("fb_comments").upsert(
          {
            page_id: cfg.page_id,
            post_id: post.id,
            comment_id: comment.id,
            parent_comment_id: comment.parent?.id ?? null,
            from_id: comment.from?.id ?? null,
            from_name: comment.from?.name ?? null,
            text: comment.message ?? null,
            permalink: comment.permalink_url ?? null,
            created_at: comment.created_time ?? new Date().toISOString(),
          },
          { onConflict: "comment_id", ignoreDuplicates: true },
        );
        if (error) throw new Error(error.message);
        comments += 1;
      }
    }
    url = result.paging?.next;
  }
  return comments;
}

export async function syncFacebookHistory(cfg: FbPageConfig, options: { fast?: boolean } = {}) {
  const fast = options.fast === true;
  if (!cfg.page_id || !cfg.page_access_token) throw new Error("আগে Facebook Page কানেক্ট করুন");
  const warnings: string[] = [];

  // Messenger and comments are independent Graph API reads. Fetch them in
  // parallel so the fallback poll is not delayed by the slower channel.
  const [messageStats, comments] = await Promise.all([
    syncMessages(cfg, fast).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[fb] message sync failed:", msg);
      warnings.push(
        /pages_messaging|appropriate role/i.test(msg)
          ? "মেসেজ আনা যাচ্ছে না — Page Token-এ pages_messaging পারমিশন নেই। Graph API Explorer থেকে pages_messaging সহ নতুন Page Token নিয়ে আবার কানেক্ট করুন।"
          : `মেসেজ সিঙ্ক ব্যর্থ: ${msg.slice(0, 160)}`,
      );
      return { conversations: 0, messages: 0 };
    }),
    syncComments(cfg, fast).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[fb] comment sync failed:", msg);
      warnings.push(`কমেন্ট সিঙ্ক ব্যর্থ: ${msg.slice(0, 160)}`);
      return 0;
    }),
  ]);

  return { ...messageStats, comments, warnings, synced_at: new Date().toISOString() };
}


export async function checkFacebookConnection(cfg: FbPageConfig) {
  const me = await fetch(`${GRAPH}/${cfg.page_id}?fields=id,name&access_token=${encodeURIComponent(cfg.page_access_token)}`);
  const body = await me.text();
  if (!me.ok) throw new Error(`পেইজ টোকেন কাজ করছে না [${me.status}]: ${body.slice(0, 180)}`);

  // Webhook subscription is optional — token may lack pages_messaging.
  // Try the full field set, then progressively smaller ones. Never fail the connection.
  const attempts = [
    "messages,messaging_postbacks,message_reactions,message_echoes,message_deliveries,message_reads,feed",
    "messages,messaging_postbacks,feed",
    "feed",
  ];
  let subscribed: string | null = null;
  for (const fields of attempts) {
    try {
      const res = await fetch(
        `${GRAPH}/${cfg.page_id}/subscribed_apps?subscribed_fields=${fields}&access_token=${encodeURIComponent(cfg.page_access_token)}`,
        { method: "POST" },
      );
      if (res.ok) {
        subscribed = fields;
        break;
      }
      console.warn(`[fb] subscribed_apps failed for "${fields}": ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      console.warn("[fb] subscribed_apps error", e);
    }
  }
  if (!subscribed) console.warn("[fb] webhook subscription skipped — polling sync will be used instead");

  const page = JSON.parse(body) as { id: string; name?: string };
  return { ...page, subscribed_fields: subscribed };
}
