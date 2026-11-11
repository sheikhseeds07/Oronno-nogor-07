import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "@/lib/personal-supabase/client";

type TikTokEvent = {
  event: string;
  event_id: string;
  event_time?: number;
  event_source_url?: string | null;
  properties?: Record<string, unknown>;
  ttclid?: string | null;
  ttp?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
};

const endpoint = `${LIVE_DATABASE_URL}/functions/v1/tiktok-events`;

async function callTikTokFunction(path = "", init?: RequestInit) {
  const response = await fetch(`${endpoint}${path}`, {
    ...init,
    headers: {
      apikey: LIVE_DATABASE_KEY,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof body.message === "string" ? body.message
      : typeof body.error === "string" ? body.error
      : `TikTok server function failed (HTTP ${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function getTikTokPublicConfig() {
  try {
    const result = await callTikTokFunction();
    return {
      pixel_id: typeof result.pixel_id === "string" ? result.pixel_id : null,
      enabled: result.enabled === true,
    };
  } catch {
    return { pixel_id: null, enabled: false };
  }
}

export async function getTikTokStatus() {
  try {
    const result = await callTikTokFunction("?status=1");
    return {
      enabled: result.enabled === true,
      pixel_id_present: result.pixel_id_present === true,
      access_token_present: result.access_token_present === true,
      test_event_code_present: result.test_event_code_present === true,
      server_events_ready: result.server_events_ready === true,
    };
  } catch {
    return {
      enabled: false,
      pixel_id_present: false,
      access_token_present: false,
      test_event_code_present: false,
      server_events_ready: false,
    };
  }
}

export async function sendTikTokEvent(input: TikTokEvent): Promise<{ ok: boolean; message?: string }> {
  try {
    const result = await callTikTokFunction("", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: result.ok === true, ...(typeof result.message === "string" ? { message: result.message } : {}) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "TikTok Events API request failed",
    };
  }
}

export async function sendTikTokPurchase(input: {
  orderId: string;
  value: number;
  contents?: Array<{ id: string; quantity: number; price: number }>;
  eventSourceUrl?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  phone?: string | null;
  ttclid?: string | null;
  ttp?: string | null;
}) {
  return sendTikTokEvent({
    event: "Purchase",
    event_id: input.orderId,
    event_source_url: input.eventSourceUrl,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    phone: input.phone,
    externalId: input.orderId,
    ttclid: input.ttclid,
    ttp: input.ttp,
    properties: {
      currency: "BDT",
      value: Number(input.value.toFixed(2)),
      order_id: input.orderId,
      ...(input.contents
        ? {
            contents: input.contents.map((item) => ({
              content_id: item.id,
              quantity: item.quantity,
              price: item.price,
            })),
            content_type: "product",
          }
        : {}),
    },
  });
}
