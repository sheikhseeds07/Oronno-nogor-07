import { createFileRoute } from "@tanstack/react-router";
import { presswayyInboundVerify, runPresswayyResync } from "@/lib/presswayy.functions";

export const Route = createFileRoute("/presswayy/v1/resync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await presswayyInboundVerify(request);
        if (!auth.ok) return new Response("Unauthorized", { status: auth.status });
        try {
          const result = await runPresswayyResync();
          return Response.json(result, { status: 202 });
        } catch (error) {
          console.error("[presswayy/resync]", error);
          return Response.json({ error: error instanceof Error ? error.message : "Resync failed" }, { status: 500 });
        }
      },
    },
  },
});
