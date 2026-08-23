import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { getPublicPixelConfig } from "@/lib/facebook-capi.server";

export const Route = createFileRoute("/api/public/fb-pixel")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getPublicPixelConfig();
        return Response.json(
          { pixel_id: config?.pixel_id ?? null, enabled: !!config?.enabled && !!config?.pixel_id },
          { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
        );
      },
    },
  },
});
