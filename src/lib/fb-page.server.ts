import { logger } from "@/lib/logger";
// Server-only Facebook Page (Messenger + Comments) helpers.
// Config lives in the admin-only `integrations` row named `facebook_page`.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const GRAPH = "https://graph.facebook.com/v21.0";

export type FbFaq = { q: string; a: string };

export type FbPageConfig = {
  app_id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  verify_token: string;
  app_secret: string;
  ai_enabled: boolean;
  reply_comments: boolean;
  private_reply: boolean;
  auto_order: boolean;
  ai_prompt: string;
  faqs: FbFaq[];
};

export const emptyFbPageConfig: FbPageConfig = {
  app_id: "",
  page_id: "",
  page_name: "",
  page_access_token: "",
  verify_token: "",
  app_secret: "",
  ai_enabled: true,
  reply_comments: true,
  private_reply: false,
  auto_order: true,
  ai_prompt: "",
  faqs: [],
};

/** System prompt add-on built from the admin's AI training (instructions + Q/A). */
export function buildTrainingPrompt(cfg: FbPageConfig): string {
  const parts: string[] = [];
  if (cfg.ai_prompt?.trim()) parts.push(cfg.ai_prompt.trim());
  const faqs = (cfg.faqs ?? []).filter((f) => f?.q?.trim() && f?.a?.trim());
  if (faqs.length) {
    parts.push(
      "নিচের প্রশ্ন-উত্তরগুলো শেখানো হয়েছে। মিলে গেলে এই উত্তরই দিন:\n" +
        faqs.map((f, i) => `${i + 1}) প্রশ্ন: ${f.q.trim()}\n   উত্তর: ${f.a.trim()}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}


let cache: { value: FbPageConfig | null; at: number } | null = null;
let tokenRefresh: Promise<string | null> | null = null;

/** Platform-level Meta app (set once as secrets) so users never touch App ID/Secret. */
export function platformFbApp(): { app_id: string; app_secret: string } | null {
  const app_id = process.env["FB_APP_ID"];
  const app_secret = process.env["FB_APP_SECRET"];
  return app_id && app_secret ? { app_id, app_secret } : null;
}

/** One stable production callback prevents changing preview domains from breaking Meta OAuth. */
export function facebookOAuthRedirectUrl(): string {
  return "https://oronnonogor.com/admin/fb-callback";
}

/**
 * Keep the production website registered on the Meta app before OAuth starts.
 * This fixes Meta's “domain isn't included in the app's domains” rejection
 * without exposing the app secret to the browser.
 */
export async function ensureFacebookAppDomain(appId: string, appSecret: string): Promise<boolean> {
  try {
  const domain = new URL(facebookOAuthRedirectUrl()).hostname;
  const appAccessToken = `${appId}|${appSecret}`;
  const currentResponse = await fetch(
    `${GRAPH}/${encodeURIComponent(appId)}?fields=app_domains&access_token=${encodeURIComponent(appAccessToken)}`,
  );
  const currentText = await currentResponse.text();
  if (!currentResponse.ok) {
    logger.warn(`[fb] app_domains read skipped [${currentResponse.status}]: ${currentText.slice(0, 180)}`);
    return false;
  }

  const current = JSON.parse(currentText) as { app_domains?: string[] };
  const domains = Array.from(new Set([...(current.app_domains ?? []), domain]));
  if (current.app_domains?.includes(domain)) return true;

  const body = new URLSearchParams({
    app_domains: JSON.stringify(domains),
    access_token: appAccessToken,
  });
  const updateResponse = await fetch(`${GRAPH}/${encodeURIComponent(appId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const updateText = await updateResponse.text();
  if (!updateResponse.ok) {
    logger.warn(`[fb] app_domains auto-add failed: add ${domain} manually. ${updateText.slice(0, 140)}`);
    return false;
  }
  return true;
  } catch (err) {
    logger.warn("[fb] ensureFacebookAppDomain skipped:", err);
    return false;
  }
}

export async function loadFbPageConfig(force = false): Promise<FbPageConfig | null> {
  const now = Date.now();
  if (!force && cache && now - cache.at < 30_000) return cache.value;
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "facebook_page")
    .maybeSingle();
  const cfg = (data?.config as Partial<FbPageConfig> | null) || null;
  const platform = platformFbApp();
  const value =
    cfg || platform
      ? {
          ...emptyFbPageConfig,
          ...(cfg ?? {}),
          ...(platform ?? {}),
          ai_enabled: (cfg?.ai_enabled ?? true) && (data?.is_active ?? true),
        }
      : null;
  cache = { value, at: now };
  return value;
}

/** Ask Meta when a token dies. `null` = never expires (proper Page token). */
export async function inspectFbToken(
  token: string,
): Promise<{ expires_at: string | null; valid: boolean; type: string } | null> {
  const app = platformFbApp();
  if (!app) return null;
  const res = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(
      `${app.app_id}|${app.app_secret}`,
    )}`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { expires_at?: number; is_valid?: boolean; type?: string; data_access_expires_at?: number };
  };
  const exp = json.data?.expires_at ?? 0;
  return {
    expires_at: exp > 0 ? new Date(exp * 1000).toISOString() : null,
    valid: !!json.data?.is_valid,
    type: json.data?.type ?? "",
  };
}

/**
 * Turn any short-lived token (Graph Explorer gives ~1 hour) into a long-lived
 * one (~60 days for user tokens). Returns the original token when the platform
 * app credentials are missing or Meta refuses the exchange.
 */
export async function extendFbToken(token: string): Promise<string> {
  const app = platformFbApp();
  if (!app) return token;
  const res = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
      app.app_id,
    )}&client_secret=${encodeURIComponent(app.app_secret)}&fb_exchange_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return token;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token || token;
}

/**
 * Recover / renew the Page token from the stored user token.
 * The user token is extended first (rolling 60-day grant), and a Page token
 * minted from a long-lived user token never expires — so a single connect keeps
 * the inbox alive for months instead of hours.
 */
export async function refreshFbPageAccessToken(pageId: string): Promise<string | null> {
  if (tokenRefresh) return tokenRefresh;
  tokenRefresh = (async () => {
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("name", "facebook_page")
      .maybeSingle();
    const config = (data?.config as Record<string, unknown> | null) ?? {};
    const stored = typeof config.user_access_token === "string" ? config.user_access_token : "";
    if (!stored || !pageId) return null;
    const userToken = await extendFbToken(stored);

    const response = await fetch(
      `${GRAPH}/${encodeURIComponent(pageId)}?fields=access_token&access_token=${encodeURIComponent(userToken)}`,
    );
    const text = await response.text();
    if (!response.ok) {
      logger.warn(`[fb] automatic Page token refresh failed [${response.status}]`);
      return null;
    }
    const nextToken = (JSON.parse(text) as { access_token?: string }).access_token;
    if (!nextToken) return null;
    const info = await inspectFbToken(nextToken);

    const { error } = await supabaseAdmin
      .from("integrations")
      .update({
        config: {
          ...config,
          user_access_token: userToken,
          page_access_token: nextToken,
          token_expires_at: info?.expires_at ?? null,
          token_checked_at: new Date().toISOString(),
        } as never,
        updated_at: new Date().toISOString(),
      })
      .eq("name", "facebook_page");
    if (error) throw new Error(error.message);
    cache = null;
    return nextToken;
  })().finally(() => {
    tokenRefresh = null;
  });
  return tokenRefresh;
}

/**
 * Called from the background autopilot: silently re-mint tokens well before
 * they die (once a day, or when the stored expiry is under 10 days away).
 */
export async function keepFbTokenFresh(): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("name", "facebook_page")
      .maybeSingle();
    const config = (data?.config as Record<string, unknown> | null) ?? {};
    const pageId = typeof config.page_id === "string" ? config.page_id : "";
    if (!pageId || !config.user_access_token) return;
    const checked = typeof config.token_checked_at === "string" ? Date.parse(config.token_checked_at) : 0;
    const expires = typeof config.token_expires_at === "string" ? Date.parse(config.token_expires_at) : NaN;
    const dueDaily = !checked || Date.now() - checked > 86_400_000;
    const nearExpiry = Number.isFinite(expires) && expires - Date.now() < 10 * 86_400_000;
    if (!dueDaily && !nearExpiry) return;
    await refreshFbPageAccessToken(pageId);
  } catch (err) {
    logger.warn("[fb] keepFbTokenFresh skipped:", err);
  }
}



export function verifyFbSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret) return true; // no secret configured -> skip (verify_token still gates setup)
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice("sha256=".length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function graph(path: string, token: string, body: unknown, pageId?: string, retried = false) {
  const res = await fetch(`${GRAPH}${path}?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (!retried && pageId && /"code"\s*:\s*190/.test(text)) {
      const refreshed = await refreshFbPageAccessToken(pageId);
      if (refreshed) return graph(path, refreshed, body, pageId, true);
    }
    logger.error(`[fb-page] ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Facebook API ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export async function sendMessengerText(cfg: FbPageConfig, psid: string, text: string) {
  return graph("/me/messages", cfg.page_access_token, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text: text.slice(0, 1900) },
  }, cfg.page_id);
}

export async function replyToComment(cfg: FbPageConfig, commentId: string, message: string) {
  return graph(`/${commentId}/comments`, cfg.page_access_token, { message: message.slice(0, 1000) }, cfg.page_id);
}

export async function privateReplyToComment(cfg: FbPageConfig, commentId: string, message: string) {
  return graph("/me/messages", cfg.page_access_token, {
    recipient: { comment_id: commentId },
    message: { text: message.slice(0, 1900) },
  }, cfg.page_id);
}

export async function fetchProfileName(cfg: FbPageConfig, psid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${psid}?fields=name&access_token=${encodeURIComponent(cfg.page_access_token)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { name?: string };
    return json.name ?? null;
  } catch {
    return null;
  }
}
