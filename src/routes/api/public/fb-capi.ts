import { logger } from "@/lib/logger";
import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getCapiStatus, sendServerEvent } from "@/lib/facebook-capi.server";

const EventSchema = z.object({
  event_name: z.enum(["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "Lead", "Contact", "AddToWishlist", "CompleteRegistration", "Purchase"]),
  event_id: z.string().min(8).max(200),
  event_time: z.number().int().positive().optional(),
  event_source_url: z.string().url().max(2000).optional().nullable(),
  user_data: z.record(z.unknown()).optional(),
  custom_data: z.record(z.unknown()).optional(),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(500).optional().nullable(),
});

const BodySchema = z.object({ event: EventSchema });
const CAPI_REVISION = "2026-08-26-server-pairing-v3";

function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

function fbcFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const fbclid = new URL(url).searchParams.get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/fb-capi")({
  server: {
    handlers: {
      GET: async () => Response.json(
        { ...(await getCapiStatus()), revision: CAPI_REVISION },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" } },
      ),
      POST: async ({ request }) => {
        try {
          const body = BodySchema.parse(await request.json());
          const event = body.event;
          const cookieHeader = getRequestHeader("cookie");
          const result = await sendServerEvent({
            event_name: event.event_name,
            event_id: event.event_id,
            event_time: event.event_time,
            event_source_url: event.event_source_url,
            user_data: event.user_data,
            custom_data: event.custom_data,
            clientIp: getRequestIP({ xForwardedFor: true }) ?? null,
            userAgent: getRequestHeader("user-agent") ?? null,
            fbp: event.fbp || readCookie(cookieHeader, "_fbp"),
            fbc: event.fbc || readCookie(cookieHeader, "_fbc") || fbcFromUrl(event.event_source_url),
          });
          return Response.json({ ok: result.ok, revision: CAPI_REVISION }, { status: result.ok ? 200 : 503 });
        } catch (error) {
          if (error instanceof z.ZodError) return Response.json( { ok: false, error: "Invalid event", revision: CAPI_REVISION }, { status: 400 });
          logger.error("[FB CAPI mirror] failed:", error);
          return Response.json({ ok: false, error: "Server event delivery failed", revision: CAPI_REVISION }, { status: 503 });
        }
      },
    },
  },
});
