// Server-only Facebook Conversions API helper.
// Sends Purchase events server-side so iOS 14+ / ad-blocker cases that miss
// the browser pixel still get reported. Reads pixel_id / access_token /
// test_event_code from site_settings.facebook.
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
  // Cache the lookup for 60s — settings rarely change.
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < 60_000) return cachedConfig.value;
  // The access_token + test_event_code live in the admin-only integrations
  // table; the pixel_id is mirrored from site_settings for the browser pixel.
  const [{ data: integ }, { data: site }] = await Promise.all([
    supabaseAdmin.from("integrations").select("config,is_active").eq("name", "facebook_capi").maybeSingle(),
    supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle(),
  ]);
  const integCfg = (integ?.config as Record<string, string> | null) || {};
  const sitePixel = (site?.settings as { facebook?: { pixel_id?: string } } | null)?.facebook?.pixel_id ?? null;
  const fb: FbConfig = {
    pixel_id: integCfg.pixel_id || sitePixel || null,
    access_token: integCfg.access_token || null,
    test_event_code: integCfg.test_event_code || null,
    enabled: integ?.is_active ?? true,
  };
  cachedConfig = { value: fb, at: now };
  return fb;
}


const sha256 = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export type PurchaseEventPayload = {
  orderId: string;
  value: number;
  currency?: string;
  phone?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string;
  contents?: Array<{ id: string; quantity: number; price: number }>;
  // Browser context (passed from the client where available):
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null; // _fbp cookie
  fbc?: string | null; // _fbc cookie
  eventSourceUrl?: string | null;
};

/**
 * Send a Purchase event to Facebook's Conversions API.
 * Returns silently — failures only logged so they never break checkout.
 */
export async function sendPurchaseEvent(payload: PurchaseEventPayload): Promise<void> {
  try {
    const cfg = await loadFbConfig();
    if (!cfg?.enabled || !cfg.pixel_id || !cfg.access_token) {
      console.warn("[FB CAPI] Purchase skipped — config missing/disabled", {
        enabled: cfg?.enabled, hasPixel: !!cfg?.pixel_id, hasToken: !!cfg?.access_token,
      });
      return;
    }

    const userData: Record<string, unknown> = {};
    if (payload.phone) {
      const digits = payload.phone.replace(/\D/g, "");
      if (digits) userData.ph = [sha256(digits)];
    }
    if (payload.name) {
      const parts = payload.name.trim().split(/\s+/);
      userData.fn = [sha256(parts[0] ?? "")];
      if (parts.length > 1) userData.ln = [sha256(parts.slice(1).join(" "))];
    }
    if (payload.city) userData.ct = [sha256(payload.city)];
    userData.country = [sha256(payload.country ?? "bd")];
    userData.external_id = [sha256(payload.orderId)];
    if (payload.clientIp) userData.client_ip_address = payload.clientIp;
    if (payload.userAgent) userData.client_user_agent = payload.userAgent;
    if (payload.fbp) userData.fbp = payload.fbp;
    if (payload.fbc) userData.fbc = payload.fbc;

    const body = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: payload.orderId,
          action_source: "website",
          event_source_url: payload.eventSourceUrl ?? undefined,
          user_data: userData,
          custom_data: {
            currency: payload.currency ?? "BDT",
            value: Number(payload.value.toFixed(2)),
            order_id: payload.orderId,
            ...(payload.contents
              ? {
                  contents: payload.contents.map((c) => ({
                    id: c.id,
                    quantity: c.quantity,
                    item_price: c.price,
                  })),
                  content_type: "product",
                  num_items: payload.contents.reduce((s, c) => s + c.quantity, 0),
                }
              : {}),
          },
        },
      ],
      ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
    };

    const url = `https://graph.facebook.com/v19.0/${cfg.pixel_id}/events?access_token=${encodeURIComponent(cfg.access_token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      console.error("[FB CAPI] Purchase FAILED", {
        orderId: payload.orderId, pixel: cfg.pixel_id, status: res.status, body: text.slice(0, 600),
      });
    } else {
      console.log("[FB CAPI] Purchase SENT", {
        orderId: payload.orderId, pixel: cfg.pixel_id, status: res.status, response: text.slice(0, 300),
      });
    }
  } catch (err) {
    console.error("[FB CAPI] Purchase threw:", err);
  }
}
