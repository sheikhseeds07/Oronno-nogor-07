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
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < 60_000) return cachedConfig.value;
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
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  eventSourceUrl?: string | null;
};

/** Send Purchase to Meta CAPI with short retries for transient network/API failures. */
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
      data: [{
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
          ...(payload.contents ? {
            contents: payload.contents.map((c) => ({ id: c.id, quantity: c.quantity, item_price: c.price })),
            content_type: "product",
            num_items: payload.contents.reduce((s, c) => s + c.quantity, 0),
          } : {}),
        },
      }],
      ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
    };

    const url = `https://graph.facebook.com/v19.0/${cfg.pixel_id}/events?access_token=${encodeURIComponent(cfg.access_token)}`;
    let lastError = "";

    // A transient Meta/network failure should not silently lose a conversion.
    // Retry only a few times so checkout remains fast and we never create a new event_id.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        const text = await res.text().catch(() => "");
        if (res.ok) {
          console.log("[FB CAPI] Purchase SENT", {
            orderId: payload.orderId, pixel: cfg.pixel_id, status: res.status,
            attempt, response: text.slice(0, 300),
          });
          return;
        }
        lastError = `HTTP ${res.status}: ${text.slice(0, 600)}`;
        // Don't retry permanent client/config errors.
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }

    console.error("[FB CAPI] Purchase FAILED after retries", {
      orderId: payload.orderId, pixel: cfg.pixel_id, error: lastError,
    });
  } catch (err) {
    console.error("[FB CAPI] Purchase threw:", err);
  }
}
