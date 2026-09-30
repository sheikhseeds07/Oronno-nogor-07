import { logger } from "@/lib/logger";
// Facebook Messenger + Page comment webhook.
// Public route: Meta calls it. Security = verify_token (GET) + X-Hub-Signature-256 (POST).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/fb-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadFbPageConfig } = await import("@/lib/fb-page.server");
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const cfg = await loadFbPageConfig(true);
        if (mode === "subscribe" && cfg?.verify_token && token === cfg.verify_token) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const raw = await request.text();
        const [{ loadFbPageConfig, verifyFbSignature }, { handleFbWebhookPayload }] = await Promise.all([
          import("@/lib/fb-page.server"),
          import("@/lib/fb-inbox.server"),
        ]);

        const cfg = await loadFbPageConfig();
        if (!cfg) return new Response("EVENT_RECEIVED", { status: 200 });

        if (!verifyFbSignature(raw, request.headers.get("x-hub-signature-256"), cfg.app_secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          await handleFbWebhookPayload(cfg, JSON.parse(raw));
        } catch (err) {
          logger.error("[fb-webhook] handler failed", err);
          return new Response("Processing failed", { status: 500 });
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
