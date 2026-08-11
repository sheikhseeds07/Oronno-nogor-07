// Scheduled Facebook autopilot: syncs the page and lets the AI answer
// every new message + comment. Called by the database scheduler every minute.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/fb-autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) return new Response("Unauthorized", { status: 401 });

        const { runFbAutopilot } = await import("@/lib/fb-autopilot.server");
        try {
          // Webhooks handle new events instantly. This short scheduled pass is a
          // reliable fallback for anything Meta did not deliver by webhook.
          const result = await runFbAutopilot();
          return Response.json(result);
        } catch (err) {
          console.error("[fb-autopilot] failed", err);
          return new Response("Autopilot failed", { status: 500 });
        }
      },
    },
  },
});
