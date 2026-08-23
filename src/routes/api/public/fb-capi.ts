import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { sendServerEvent } from "@/lib/facebook-capi.server";

const EventSchema = z.object({
  event_name: z.enum(["PageView", "ViewContent", "Search", "AddToCart", "InitiateCheckout", "Lead", "Contact"]),
  event_id: z.string().min(8).max(200),
  event_time: z.number().int().positive().optional(),
  event_source_url: z.string().url().max(2000).optional().nullable(),
  user_data: z.record(z.unknown()).optional(),
  custom_data: z.record(z.unknown()).optional(),
});

const BodySchema = z.object({ event: EventSchema });

export const Route = createFileRoute("/api/public/fb-capi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = BodySchema.parse(await request.json());
          const result = await sendServerEvent({
            ...body.event,
            clientIp: getRequestIP({ xForwardedFor: true }) ?? null,
            userAgent: getRequestHeader("user-agent") ?? null,
          });
          return Response.json({ ok: result.ok }, { status: result.ok ? 200 : 202 });
        } catch (error) {
          if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Invalid event" }, { status: 400 });
          console.error("[FB CAPI mirror] failed:", error);
          return Response.json({ ok: false }, { status: 202 });
        }
      },
    },
  },
});
