import { createFileRoute } from "@tanstack/react-router";
import { handlePresswayyInventory, presswayyInboundVerify } from "@/lib/presswayy.functions";

export const Route = createFileRoute("/presswayy/v1/inventory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await presswayyInboundVerify(request);
        if (!auth.ok) return new Response("Unauthorized", { status: auth.status });
        try {
          return Response.json(await handlePresswayyInventory(JSON.parse(auth.raw)));
        } catch (error) {
          console.error("[presswayy/inventory]", error);
          return Response.json({ error: error instanceof Error ? error.message : "Inventory update failed" }, { status: 400 });
        }
      },
    },
  },
});
