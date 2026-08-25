import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

type FbConfig = {
  pixel_id?: string | null;
  access_token?: string | null;
  test_event_code?: string | null;
  enabled?: boolean | null;
};

let cachedConfig: { value: FbConfig | null; at: number } | null = null;

async function loadFbConfig(): Promise<FbConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < 60_000) return cachedConfig.value;

  const [{ data: integ }, { data: site }] = await Promise.all([
    supabaseAdmin.from("integrations").select("config,is_active").eq("name", "facebook_capi").maybeSingle(),
    supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle(),
  ]);
  const integCfg = (integ?.config as Record<string, string> | null) ?? {};
  const siteFacebook = (site?.settings as { facebook?: { pixel_id?: string; enabled?: boolean } } | null)?.facebook;
  const value: FbConfig = {
    pixel_id: integCfg.pixel_id || siteFacebook?.pixel_id || null,
    access_token: integCfg.access_token || null,
    test_event_code: integCfg.test_event_code || null,
    enabled: integ?.is_active ?? siteFacebook?.enabled ?? true,
  };
  cachedConfig = { value, at: now };
  return value;
}

export async function getPublicPixelConfig(): Promise<{ pixel_id: string | null; enabled: boolean } | null> {
  const cfg = await loadFbConfig();
  return cfg ? { pixel_id: cfg.pixel_id ?? null, enabled: cfg.enabled !== false } : null;
}

/** Non-secret readiness snapshot so the pixel setup can be verified without leaking the token. */
export async function getCapiStatus() {
  const cfg = await loadFbConfig();
  return {
    enabled: cfg?.enabled !== false,
    pixel_id_present: !!cfg?.pixel_id,
    access_token_present: !!cfg?.access_token,
    test_event_code_present: !!cfg?.test_event_code,
    server_events_ready: cfg?.enabled !== false && !!cfg?.pixel_id && !!cfg?.access_token,
  };
}

const sha256 = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export type ServerEventPayload = {
  event_name: string;
  event_id: string;
  event_time?: number;
  event_source_url?: string | null;
  user_data?: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  externalId?: string | null;
};

function buildUserData(payload: ServerEventPayload) {
  const userData = { ...(payload.user_data ?? {}) } as Record<string, unknown>;
  if (payload.clientIp) userData.client_ip_address = payload.clientIp;
  if (payload.userAgent) userData.client_user_agent = payload.userAgent;
  // fbp / fbc are the strongest match signals for website events and are sent raw (never hashed).
  if (payload.fbp && !userData.fbp) userData.fbp = payload.fbp;
  if (payload.fbc && !userData.fbc) userData.fbc = payload.fbc;
  if (payload.externalId && !userData.external_id) userData.external_id = [sha256(payload.externalId)];
  return userData;
}

/** Send any supported website event to Meta CAPI. */
export async function sendServerEvent(payload: ServerEventPayload): Promise<{ ok: boolean }> {
  const cfg = await loadFbConfig();
  if (!cfg?.enabled || !cfg.pixel_id || !cfg.access_token) return { ok: false };

  const now = Math.floor(Date.now() / 1000);
  // Meta rejects events dated in the future or older than 7 days.
  const eventTime = payload.event_time && payload.event_time <= now + 60 && payload.event_time > now - 6 * 24 * 3600 ? payload.event_time : now;

  const body = {
    data: [{
      event_name: payload.event_name,
      event_time: eventTime,
      event_id: payload.event_id,
      action_source: "website",
      ...(payload.event_source_url ? { event_source_url: payload.event_source_url } : {}),
      user_data: buildUserData(payload),
      ...(payload.custom_data ? { custom_data: payload.custom_data } : {}),
    }],
    ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
  };

  const url = `https://graph.facebook.com/v23.0/${cfg.pixel_id}/events?access_token=${encodeURIComponent(cfg.access_token)}`;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) return { ok: true };
      const text = await response.text().catch(() => "");
      lastError = `HTTP ${response.status}: ${text.slice(0, 500)}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
  console.error("[FB CAPI] event failed", { event: payload.event_name, eventId: payload.event_id, error: lastError });
  return { ok: false };
}

export type PurchaseEventPayload = {
  orderId: string;
  value: number;
  currency?: string;
  phone?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string;
  contents?: Array<{ id: string; quantity: number; price: number }>;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  eventSourceUrl?: string | null;
};

/** Purchase uses the order id as the shared browser/CAPI event_id for deduplication. */
export async function sendPurchaseEvent(payload: PurchaseEventPayload): Promise<void> {
  const userData: Record<string, unknown> = { external_id: [sha256(payload.orderId)], country: [sha256(payload.country ?? "bd")] };
  if (payload.phone) {
    const digits = payload.phone.replace(/\D/g, "");
    if (digits) {
      // Meta expects E.164 digits without "+": local 01XXXXXXXXX -> 8801XXXXXXXXX
      const e164 = digits.startsWith("880") ? digits : digits.replace(/^0/, "880");
      userData.ph = [sha256(e164)];
    }
  }
  if (payload.name) {
    const parts = payload.name.trim().split(/\s+/);
    if (parts[0]) userData.fn = [sha256(parts[0])];
    if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(" "))];
  }
  if (payload.city) userData.ct = [sha256(payload.city.replace(/\s+/g, ""))];

  await sendServerEvent({
    event_name: "Purchase",
    event_id: payload.orderId,
    event_source_url: payload.eventSourceUrl,
    user_data: userData,
    fbp: payload.fbp ?? null,
    fbc: payload.fbc ?? null,
    custom_data: {
      currency: payload.currency ?? "BDT",
      value: Number(payload.value.toFixed(2)),
      order_id: payload.orderId,
      ...(payload.contents ? {
        contents: payload.contents.map((c) => ({ id: c.id, quantity: c.quantity, item_price: c.price })),
        content_type: "product",
        num_items: payload.contents.reduce((sum, item) => sum + item.quantity, 0),
      } : {}),
    },
    clientIp: payload.clientIp,
    userAgent: payload.userAgent,
  });
}
