import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const HeartbeatInput = z.object({
  id: z.string().uuid(),
  path: z.string().min(1).max(300),
  landingPageId: z.string().uuid().nullable(),
  productId: z.string().uuid().nullable(),
});

export const Route = createFileRoute("/api/visitor/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = HeartbeatInput.safeParse(await request.json().catch(() => null));
        if (!input.success) return new Response(null, { status: 400 });

        const { id, path, landingPageId, productId } = input.data;
        if (path !== "/" && !path.startsWith("/landing/")) {
          return new Response(null, { status: 400 });
        }

        // Analytics-only: preserve the existing best-effort behavior and never
        // block page rendering if the heartbeat RPC is temporarily unavailable.
        try {
          const { error } = await (supabaseAdmin as any).rpc("heartbeat_site_visitor", {
            p_id: id,
            p_path: path,
            p_landing_page_id: landingPageId,
            p_product_id: productId,
          });
          if (error) return new Response(null, { status: 204 });
        } catch {
          // Deliberately silent, matching the previous browser-side tracker.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
