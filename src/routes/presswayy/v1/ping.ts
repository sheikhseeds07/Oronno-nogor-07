import { createFileRoute } from "@tanstack/react-router";
import { presswayyInboundVerify } from "@/lib/presswayy.functions";

export const Route = createFileRoute("/presswayy/v1/ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await presswayyInboundVerify(request);
        if (!auth.ok) return new Response("Unauthorized", { status: auth.status });
        return Response.json({ ok: true });
      },
    },
  },
});
