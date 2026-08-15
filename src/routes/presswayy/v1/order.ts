import { createFileRoute } from "@tanstack/react-router";
import { handlePresswayyOrder, presswayyInboundVerify } from "@/lib/presswayy.functions";

export const Route = createFileRoute("/presswayy/v1/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await presswayyInboundVerify(request);
        if (!auth.ok) return new Response("Unauthorized", { status: auth.status });
        try {
          const result = await handlePresswayyOrder(JSON.parse(auth.raw));
          return Response.json(result, { status: 201 });
        } catch (error) {
          console.error("[presswayy/order]", error);
          return Response.json({ error: error instanceof Error ? error.message : "Order failed" }, { status: 400 });
        }
      },
    },
  },
});
