import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { getTikTokPublicConfig, getTikTokStatus, sendTikTokEvent } from "@/lib/tiktok-events.server";

const EventSchema = z.object({
  event: z.enum(["PageView","ViewContent","Search","AddToCart","InitiateCheckout","Lead","Contact","Purchase"]),
  event_id: z.string().min(8).max(200),
  event_time: z.number().int().positive().optional(),
  event_source_url: z.string().url().max(2000).optional().nullable(),
  properties: z.record(z.unknown()).optional(),
  ttclid: z.string().max(1000).optional().nullable(),
  ttp: z.string().max(500).optional().nullable(),
  externalId: z.string().max(500).optional().nullable(),
});
export const Route = createFileRoute("/api/public/tiktok-events")({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get("status") === "1") return Response.json(await getTikTokStatus(), { headers: { "Cache-Control": "no-store" } });
      return Response.json(await getTikTokPublicConfig(), { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
    },
    POST: async ({ request }) => {
      try {
        const event = EventSchema.parse(await request.json());
        const result = await sendTikTokEvent({ ...event, clientIp: getRequestIP({ xForwardedFor: true }) ?? null, userAgent: getRequestHeader("user-agent") ?? null });
        return Response.json({ ok: result.ok, ...(result.message ? { message: result.message } : {}) }, { status: result.ok ? 200 : 503 });
      } catch (error) {
        if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid event" }, { status: 400 });
        return Response.json({ ok: false, error: "TikTok event delivery failed" }, { status: 503 });
      }
    },
  } },
});
