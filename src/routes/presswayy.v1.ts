import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/presswayy/v1")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { presswayyInboundVerify, handlePresswayyOrder, handlePresswayyInventory } = await import("@/lib/presswayy.functions");
        const verified = await presswayyInboundVerify(request);
        if (!verified.ok) return new Response("Unauthorized", { status: verified.status });

        const topic = request.headers.get("x-presswayy-topic") ?? "";
        let payload: any;
        try {
          payload = JSON.parse(verified.raw);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          if (topic.startsWith("order.")) await handlePresswayyOrder(payload);
          else if (topic.startsWith("inventory.")) await handlePresswayyInventory(payload);
          else return new Response("EVENT_RECEIVED", { status: 200 });
        } catch (error) {
          console.error("[presswayy-v1] processing failed", error);
          return new Response("Processing failed", { status: 500 });
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
