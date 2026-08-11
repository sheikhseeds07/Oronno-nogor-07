// Facebook Page connect (Login → pick page), AI training, messenger orders & tickets.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

async function guard(userId: string) {
  const { assertIsStaff } = await import("@/lib/_admin-guard.server");
  await assertIsStaff(userId);
}

/** Public-safe connection state for the admin UI (no tokens/secrets returned). */
export const getFbConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { loadFbPageConfig, emptyFbPageConfig, platformFbApp, facebookOAuthRedirectUrl } = await import(
      "@/lib/fb-page.server"
    );
    let cfg = (await loadFbPageConfig(true)) ?? emptyFbPageConfig;
    // Webhook verify token is generated automatically — the admin never types anything.
    if (!cfg.verify_token) {
      const { randomBytes } = await import("crypto");
      cfg = (await patchConfig({ verify_token: randomBytes(16).toString("hex") })) as typeof cfg;
    }
    let tokenValid = false;
    if (cfg.page_id && cfg.page_access_token) {
      const check = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.page_id)}?fields=id&access_token=${encodeURIComponent(cfg.page_access_token)}`,
      );
      tokenValid = check.ok;
    }
    return {
      app_id: cfg.app_id,
      has_app_secret: !!cfg.app_secret,
      platform_app: !!platformFbApp(),
      verify_token: cfg.verify_token,
      page_id: cfg.page_id,
      page_name: cfg.page_name,
      connected: !!(cfg.page_id && cfg.page_access_token && tokenValid),
      reconnect_required: !!(cfg.page_id && cfg.page_access_token && !tokenValid),
      ai_enabled: cfg.ai_enabled,
      reply_comments: cfg.reply_comments,
      private_reply: cfg.private_reply,
      auto_order: cfg.auto_order,
      ai_prompt: cfg.ai_prompt,
      faqs: cfg.faqs ?? [],
      redirect_uri: facebookOAuthRedirectUrl(),
      app_domain: new URL(facebookOAuthRedirectUrl()).hostname,
      webhook_url: `${new URL(facebookOAuthRedirectUrl()).origin}/api/public/fb-webhook`,
    };
  });

async function patchConfig(patch: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
  const { loadFbPageConfig, emptyFbPageConfig, platformFbApp } = await import("@/lib/fb-page.server");
  const current = (await loadFbPageConfig(true)) ?? emptyFbPageConfig;
  const next = { ...current, ...patch } as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Platform-level credentials live in secrets, never in the database.
  if (platformFbApp()) {
    delete next.app_id;
    delete next.app_secret;
  }
  const { error } = await supabaseAdmin.from("integrations").upsert(
    { name: "facebook_page", is_active: true, config: next as never, updated_at: new Date().toISOString() },
    { onConflict: "name" },
  );
  if (error) throw new Error(error.message);
  return (await loadFbPageConfig(true)) ?? emptyFbPageConfig;
}


/** One-time Meta app credentials (App ID + App Secret) — needed for Facebook Login. */
export const saveFbApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ app_id: z.string().trim().min(5).max(40), app_secret: z.string().trim().min(10).max(120) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { randomBytes } = await import("crypto");
    const { loadFbPageConfig } = await import("@/lib/fb-page.server");
    const cur = await loadFbPageConfig(true);
    await patchConfig({
      app_id: data.app_id,
      app_secret: data.app_secret,
      verify_token: cur?.verify_token || randomBytes(16).toString("hex"),
    });
    return { ok: true };
  });

/** Verify the saved App ID + Secret against Meta and report what still needs doing. */
export const checkFbSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { loadFbPageConfig, facebookOAuthRedirectUrl } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    const redirect = facebookOAuthRedirectUrl();
    if (!cfg?.app_id || !cfg.app_secret) {
      return { ok: false, step: "app" as const, message: "App ID ও App Secret এখনো সেভ করা হয়নি" };
    }
    const token = `${cfg.app_id}|${cfg.app_secret}`;
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.app_id)}?fields=name,app_domains,link&access_token=${encodeURIComponent(token)}`,
    );
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        step: "app" as const,
        message: "App ID ও App Secret একই Meta App-এর নয় (বা Secret ভুল)। Settings → Basic থেকে আবার কপি করুন।",
      };
    }
    const app = JSON.parse(text) as { name?: string; app_domains?: string[] };
    const host = new URL(redirect).hostname;
    const domainOk = (app.app_domains ?? []).includes(host);
    return {
      ok: true,
      step: "login" as const,
      app_name: app.name ?? "",
      domain_ok: domainOk,
      message: domainOk
        ? `App ঠিক আছে: ${app.name ?? ""}`
        : `App ঠিক আছে (${app.name ?? ""}), তবে App Domains-এ ${host} যোগ করা নেই`,
    };
  });

const FB_SCOPES =
  "public_profile,pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_manage_engagement,business_management";

/** Build the Facebook Login redirect URL (server-side OAuth — no JS SDK toggle needed). */
export const getFbLoginUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { loadFbPageConfig, facebookOAuthRedirectUrl, ensureFacebookAppDomain } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.app_id || !cfg.app_secret) throw new Error("আগে Meta App ID ও App Secret সেভ করুন");
    void (await ensureFacebookAppDomain(cfg.app_id, cfg.app_secret));
    const { randomBytes } = await import("crypto");
    const state = randomBytes(12).toString("hex");
    await patchConfig({ oauth_state: state });
    const redirectUri = facebookOAuthRedirectUrl();
    const url =
      `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(cfg.app_id)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}&response_type=code&auth_type=rerequest` +
      `&scope=${encodeURIComponent(FB_SCOPES)}`;
    return { url, redirect_uri: redirectUri };
  });

async function pagesFromLongToken(longToken: string) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?limit=100&fields=id,name,access_token,picture{url},category,tasks&access_token=${encodeURIComponent(longToken)}`,
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`পেইজ লিস্ট আনা যায়নি: ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as {
    data?: { id: string; name: string; category?: string; picture?: { data?: { url?: string } } }[];
  };
  const pages = (json.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? "",
    picture: p.picture?.data?.url ?? "",
  }));
  // Keep the long-lived user token so we can pull the page token on select.
  await patchConfig({ user_access_token: longToken });
  return { pages };
}

/** Exchange the OAuth `code` from the redirect for a long-lived token, then list pages. */
export const listFbPagesForCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ code: z.string().min(10), state: z.string().min(16).max(128) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { loadFbPageConfig, facebookOAuthRedirectUrl } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.app_id || !cfg.app_secret) throw new Error("আগে Meta App ID ও App Secret সেভ করুন");
    const savedState = (cfg as typeof cfg & { oauth_state?: string }).oauth_state;
    if (!savedState || data.state !== savedState) throw new Error("Facebook লগইন সেশনটি মেয়াদোত্তীর্ণ। আবার চেষ্টা করুন।");
    await patchConfig({ oauth_state: "" });
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(cfg.app_id)}&client_secret=${encodeURIComponent(cfg.app_secret)}&redirect_uri=${encodeURIComponent(facebookOAuthRedirectUrl())}&code=${encodeURIComponent(data.code)}`,
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`টোকেন এক্সচেঞ্জ ব্যর্থ: ${text.slice(0, 200)}`);
    const shortToken = (JSON.parse(text) as { access_token: string }).access_token;
    const exRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(cfg.app_id)}&client_secret=${encodeURIComponent(cfg.app_secret)}&fb_exchange_token=${encodeURIComponent(shortToken)}`,
    );
    const exText = await exRes.text();
    const longToken = exRes.ok ? (JSON.parse(exText) as { access_token: string }).access_token : shortToken;
    return pagesFromLongToken(longToken);
  });

/** Legacy: exchange a JS-SDK short-lived token (kept for compatibility). */
export const listFbPagesForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_token: z.string().min(20) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { loadFbPageConfig } = await import("@/lib/fb-page.server");
    const cfg = await loadFbPageConfig(true);
    if (!cfg?.app_id || !cfg.app_secret) throw new Error("আগে Meta App ID ও App Secret সেভ করুন");
    const exRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(cfg.app_id)}&client_secret=${encodeURIComponent(cfg.app_secret)}&fb_exchange_token=${encodeURIComponent(data.user_token)}`,
    );
    const exText = await exRes.text();
    if (!exRes.ok) throw new Error(`টোকেন এক্সচেঞ্জ ব্যর্থ: ${exText.slice(0, 200)}`);
    const longToken = (JSON.parse(exText) as { access_token: string }).access_token;
    return pagesFromLongToken(longToken);
  });



/** Select a page: store its never-expiring token and subscribe the webhook automatically. */
export const connectFbPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ page_id: z.string().min(3), page_name: z.string().default("") }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { loadFbPageConfig, extendFbToken, inspectFbToken } = await import("@/lib/fb-page.server");
    const cfg = (await loadFbPageConfig(true)) as (Record<string, unknown> & { user_access_token?: string }) | null;
    if (!cfg?.user_access_token) throw new Error("আগে Facebook দিয়ে লগইন করুন");
    // Long-lived user token → Page token that does not expire.
    const userToken = await extendFbToken(cfg.user_access_token);

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${data.page_id}?fields=name,access_token&access_token=${encodeURIComponent(userToken)}`,
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`পেইজ টোকেন আনা যায়নি: ${text.slice(0, 200)}`);
    const page = JSON.parse(text) as { name?: string; access_token?: string };
    if (!page.access_token) throw new Error("এই পেইজে মেসেজ পরিচালনার অনুমতি পাওয়া যায়নি");
    const info = await inspectFbToken(page.access_token);

    await patchConfig({
      page_id: data.page_id,
      page_name: page.name || data.page_name,
      page_access_token: page.access_token,
      user_access_token: userToken,
      token_expires_at: info?.expires_at ?? null,
      token_checked_at: new Date().toISOString(),
    });


    // Subscribe the app to this page's messages + comments.
    let warning: string | null = null;
    const { checkFacebookConnection, syncFacebookHistory } = await import("@/lib/fb-sync.server");
    const connectedCfg = await loadFbPageConfig(true);
    if (connectedCfg) {
      try {
        await checkFacebookConnection(connectedCfg);
        await syncFacebookHistory(connectedCfg);
      } catch (error) {
        warning = error instanceof Error ? error.message : "প্রথম sync সম্পন্ন হয়নি";
      }
    }

    return { ok: true, page_name: page.name || data.page_name, warning };
  });

/**
 * Easiest path: paste a Page Access Token (or a User token) — no Meta App setup needed.
 * A page token connects instantly; a user token returns the page list to pick from.
 */
export const connectFbByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ token: z.string().trim().min(30).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { extendFbToken, inspectFbToken } = await import("@/lib/fb-page.server");
    // Graph Explorer tokens live ~1 hour; extend first so the connection lasts months.
    const token = await extendFbToken(data.token.trim());
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
    );
    const meText = await meRes.text();
    if (!meRes.ok) throw new Error(`টোকেনটি কাজ করছে না: ${meText.slice(0, 160)}`);
    const me = JSON.parse(meText) as { id: string; name?: string };

    // Is this a Page token? /me/accounts on a page token errors, and the id is a page id.
    const pageRes = await fetch(
      `https://graph.facebook.com/v21.0/${me.id}?fields=name,fan_count&access_token=${encodeURIComponent(token)}`,
    );
    const isPage = pageRes.ok && "fan_count" in (JSON.parse(await pageRes.text()) as Record<string, unknown>);

    if (isPage) {
      const info = await inspectFbToken(token);
      await patchConfig({
        page_id: me.id,
        page_name: me.name ?? "",
        page_access_token: token,
        token_expires_at: info?.expires_at ?? null,
        token_checked_at: new Date().toISOString(),
      });
      const { loadFbPageConfig } = await import("@/lib/fb-page.server");
      const cfg = await loadFbPageConfig(true);
      let warning: string | null = null;
      if (cfg) {
        const { checkFacebookConnection, syncFacebookHistory } = await import("@/lib/fb-sync.server");
        try {
          await checkFacebookConnection(cfg);
          await syncFacebookHistory(cfg);
        } catch (error) {
          warning = error instanceof Error ? error.message : "প্রথম sync সম্পন্ন হয়নি";
        }
      }
      if (!warning && info?.expires_at) {
        warning =
          "এই Page টোকেনের মেয়াদ শেষ হবে " +
          new Date(info.expires_at).toLocaleString("bn-BD") +
          "। স্থায়ী সংযোগের জন্য User Access Token পেস্ট করে পেইজ সিলেক্ট করুন।";
      }
      return { mode: "connected" as const, page_name: me.name ?? "", pages: [], warning };
    }

    const { pages } = await pagesFromLongToken(token);
    if (!pages.length) throw new Error("এই টোকেনে পরিচালনা করার মতো কোনো পেইজ পাওয়া যায়নি");
    return { mode: "pages" as const, page_name: "", pages, warning: null };
  });


export const disconnectFbPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    await patchConfig({ page_id: "", page_name: "", page_access_token: "", user_access_token: "" });
    return { ok: true };
  });

export const saveFbAiTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        ai_prompt: z.string().max(4000).default(""),
        faqs: z.array(z.object({ q: z.string().max(300), a: z.string().max(1500) })).max(100).default([]),
        ai_enabled: z.boolean(),
        auto_order: z.boolean(),
        reply_comments: z.boolean(),
        private_reply: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    await patchConfig({
      ...data,
      faqs: data.faqs.filter((f) => f.q.trim() && f.a.trim()),
    });
    return { ok: true };
  });

/** Orders that came from Messenger. */
export const listMessengerOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id,invoice_no,status,customer_name,customer_phone,customer_address,total,created_at")
      .eq("source", "messenger")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Problem tickets = conversations the AI escalated to a human. */
export const listFbTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ resolved: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    let q = supabaseAdmin
      .from("fb_conversations")
      .select("id,customer_name,customer_phone,last_message_text,last_message_at,status,needs_human")
      .order("last_message_at", { ascending: false })
      .limit(100);
    q = data.resolved ? q.eq("status", "closed") : q.eq("needs_human", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resolveFbTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid(), reopen: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const { error } = await supabaseAdmin
      .from("fb_conversations")
      .update(
        data.reopen
          ? { needs_human: true, status: "human" }
          : { needs_human: false, status: "closed" },
      )
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Message dashboard counters. */
export const fbDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.userId);
    const { supabaseAdmin } = await import("@/lib/personal-supabase/client.server");
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const count = (q: { count: number | null }) => q.count ?? 0;
    const [convs, open, tickets, aiMsgs, inMsgs, comments, orders] = await Promise.all([
      supabaseAdmin.from("fb_conversations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("fb_conversations").select("id", { count: "exact", head: true }).gt("unread_count", 0),
      supabaseAdmin.from("fb_conversations").select("id", { count: "exact", head: true }).eq("needs_human", true),
      supabaseAdmin.from("fb_messages").select("id", { count: "exact", head: true }).eq("sent_by", "ai").gte("created_at", since),
      supabaseAdmin.from("fb_messages").select("id", { count: "exact", head: true }).eq("direction", "in").gte("created_at", since),
      supabaseAdmin.from("fb_comments").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("orders").select("total", { count: "exact" }).eq("source", "messenger").is("deleted_at", null).gte("created_at", since),
    ]);
    const revenue = (orders.data ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0);
    return {
      conversations: count(convs),
      unread: count(open),
      tickets: count(tickets),
      ai_replies_7d: count(aiMsgs),
      incoming_7d: count(inMsgs),
      comments_7d: count(comments),
      orders_7d: count(orders),
      revenue_7d: revenue,
    };
  });
