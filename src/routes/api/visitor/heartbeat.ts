import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const HeartbeatInput = z.object({
  id: z.string().uuid(),
  path: z.string().min(1).max(300),
});

type LandingIds = { landingPageId: string | null; productId: string | null };
const LANDING_LOOKUP_TTL_MS = 5 * 60_000;
const landingLookupCache = new Map<string, { expiresAt: number; value: LandingIds }>();

async function getLandingIds(slug: string): Promise<LandingIds> {
  const now = Date.now();
  const cached = landingLookupCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) landingLookupCache.delete(slug);

  const { data, error } = await supabaseAdmin
    .from("landing_pages")
    .select("id,product_id")
    .eq("slug", slug)
    .maybeSingle();

  const value: LandingIds = {
    landingPageId: error ? null : data?.id ?? null,
    productId: error ? null : data?.product_id ?? null,
  };
  if (landingLookupCache.size >= 500) {
    for (const [key, entry] of landingLookupCache) {
      if (entry.expiresAt <= now) landingLookupCache.delete(key);
    }
    while (landingLookupCache.size >= 500) {
      const oldest = landingLookupCache.keys().next().value as string | undefined;
      if (!oldest) break;
      landingLookupCache.delete(oldest);
    }
  }
  landingLookupCache.set(slug, {
    expiresAt: now + (error ? 30_000 : data ? LANDING_LOOKUP_TTL_MS : 60_000),
    value,
  });
  return value;
}

export const Route = createFileRoute("/api/visitor/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = HeartbeatInput.safeParse(await request.json().catch(() => null));
        if (!input.success) return new Response(null, { status: 400 });

        const { id, path } = input.data;
        if (path !== "/" && !path.startsWith("/landing/")) {
          return new Response(null, { status: 400 });
        }

        const segments = path.split("/").filter(Boolean);
        const slug = segments[0] === "landing" ? segments[1] ?? null : null;
        const ids = slug ? await getLandingIds(slug) : { landingPageId: null, productId: null };

        // Analytics-only: preserve the existing best-effort behavior and never
        // block page rendering if the heartbeat RPC is temporarily unavailable.
        try {
          await (supabaseAdmin as any).rpc("heartbeat_site_visitor", {
            p_id: id,
            p_path: path,
            p_landing_page_id: ids.landingPageId,
            p_product_id: ids.productId,
          });
        } catch {
          // Deliberately silent, matching the previous browser-side tracker.
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
