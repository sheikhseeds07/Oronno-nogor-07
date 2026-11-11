import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { createHash } from "crypto";

type TikTokConfig = { pixel_id?: string; access_token?: string; test_event_code?: string; };
type TikTokEvent = { event: string; event_id: string; event_time?: number; event_source_url?: string | null; properties?: Record<string, unknown>; ttclid?: string | null; ttp?: string | null; clientIp?: string | null; userAgent?: string | null; email?: string | null; phone?: string | null; externalId?: string | null; };

const hash = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
async function loadConfig(): Promise<{ config: TikTokConfig; enabled: boolean }> {
  const { data, error } = await supabaseAdmin.from("integrations").select("config,is_active").eq("name", "tiktok_pixel").maybeSingle();
  if (error) throw new Error(error.message);
  return { config: (data?.config ?? {}) as TikTokConfig, enabled: data?.is_active === true };
}
export async function getTikTokPublicConfig() {
  try { const { config, enabled } = await loadConfig(); return { pixel_id: enabled ? config.pixel_id ?? null : null, enabled: enabled && !!config.pixel_id }; }
  catch (error) { logger.error("[TikTok config]", error); return { pixel_id: null, enabled: false }; }
}
export async function getTikTokStatus() {
  try {
    const { config, enabled } = await loadConfig();
    return { enabled, pixel_id_present: !!config.pixel_id, access_token_present: !!config.access_token, test_event_code_present: !!config.test_event_code, server_events_ready: enabled && !!config.pixel_id && !!config.access_token };
  } catch { return { enabled: false, pixel_id_present: false, access_token_present: false, test_event_code_present: false, server_events_ready: false }; }
}
export async function sendTikTokEvent(input: TikTokEvent): Promise<{ ok: boolean; message?: string }> {
  const { config, enabled } = await loadConfig();
  if (!enabled || !config.pixel_id || !config.access_token) return { ok: false, message: "TikTok Pixel ও Access Token সেটআপ করা নেই" };
  const now = Math.floor(Date.now() / 1000);
  const eventTime = input.event_time && input.event_time <= now + 60 && input.event_time > now - 7 * 86400 ? input.event_time : now;
  const user: Record<string, unknown> = {};
  if (input.ttclid) user.ttclid = input.ttclid.slice(0, 1000);
  if (input.ttp) user.ttp = input.ttp.slice(0, 500);
  if (input.clientIp) user.ip = input.clientIp;
  if (input.userAgent) user.user_agent = input.userAgent;
  if (input.email) user.email = hash(input.email);
  if (input.phone) user.phone = hash(input.phone.replace(/\\D/g, ""));
  if (input.externalId) user.external_id = hash(input.externalId);
  const body = {
    event_source: "web",
    event_source_id: config.pixel_id,
    data: [{
      event: input.event,
      event_id: input.event_id,
      event_time: eventTime,
      ...(input.event_source_url ? { page: { url: input.event_source_url } } : {}),
      user,
      ...(input.properties ? { properties: input.properties } : {}),
    }],
    ...(config.test_event_code ? { test_event_code: config.test_event_code } : {}),
  };
  try {
    const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": config.access_token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json().catch(() => ({})) as { code?: number; message?: string };
    if (response.ok && result.code === 0) return { ok: true };
    logger.error("[TikTok Events API rejected]", { event: input.event, event_id: input.event_id, status: response.status, code: result.code, message: result.message });
    return { ok: false, message: result.message || "TikTok Events API rejected the event" };
  } catch (error) {
    logger.error("[TikTok Events API failed]", { event: input.event, event_id: input.event_id, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, message: "TikTok Events API request failed" };
  }
}
export async function sendTikTokPurchase(input: { orderId: string; value: number; contents?: Array<{ id: string; quantity: number; price: number }>; eventSourceUrl?: string | null; clientIp?: string | null; userAgent?: string | null; phone?: string | null; }) {
  return sendTikTokEvent({
    event: "Purchase", event_id: input.orderId, event_source_url: input.eventSourceUrl,
    clientIp: input.clientIp, userAgent: input.userAgent, phone: input.phone, externalId: input.orderId,
    properties: { currency: "BDT", value: Number(input.value.toFixed(2)), order_id: input.orderId,
      ...(input.contents ? { contents: input.contents.map((item) => ({ content_id: item.id, quantity: item.quantity, price: item.price })), content_type: "product" } : {}) },
  });
}
