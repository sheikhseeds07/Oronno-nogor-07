import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/fb-autopilot-loop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) return new Response("Unauthorized", { status: 401 });
        try {
          const { runFbAutopilotLoop } = await import("@/lib/fb-autopilot-loop.server");
          return Response.json(await runFbAutopilotLoop());
        } catch (error) {
          console.error("[fb-autopilot-loop] failed", error);
          return new Response("Autopilot failed", { status: 500 });
        }
      },
    },
  },
});
