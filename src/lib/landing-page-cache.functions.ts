import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabase } from "@/lib/personal-supabase/client";
import { LANDING_PAGES_COLUMNS, LANDING_PRODUCT_COLUMNS } from "@/lib/read-columns";

type EdgeCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

function edgeCacheKey(slug: string): Request | null {
  try {
    const request = getRequest();
    if (!request?.url) return null;
    const url = new URL(`/__oronno_edge_cache/landing-pages/${encodeURIComponent(slug)}?v=landing-v4`, request.url);
    return new Request(url.toString(), { method: "GET" });
  } catch {
    return null;
  }
}

async function readEdgeCache(slug: string): Promise<{ hit: boolean; page?: unknown }> {
  const cache = (globalThis as typeof globalThis & { caches?: { default?: EdgeCache } }).caches?.default;
  const key = edgeCacheKey(slug);
  if (!cache || !key) return { hit: false };
  try {
    const response = await cache.match(key);
    if (!response) return { hit: false };
    const payload = await response.json() as { page?: unknown };
    return { hit: true, page: payload?.page ?? null };
  } catch {
    return { hit: false };
  }
}

async function writeEdgeCache(slug: string, page: unknown): Promise<void> {
  const cache = (globalThis as typeof globalThis & { caches?: { default?: EdgeCache } }).caches?.default;
  const key = edgeCacheKey(slug);
  if (!cache || !key) return;
  try {
    await cache.put(key, new Response(JSON.stringify({ page }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    }));
  } catch {
    // Cache failures must never affect landing-page rendering.
  }
}

/** Fetch a published landing page through a shared Cloudflare cache for SSR. */
export const getLandingPageForRoute = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(160) }).parse(input))
  .handler(async ({ data }) => {
    const cached = await readEdgeCache(data.slug);
    if (cached.hit) return cached.page ?? null;

    const { data: page, error } = await supabase
      .from("landing_pages")
      .select(`${LANDING_PAGES_COLUMNS}, products(${LANDING_PRODUCT_COLUMNS})`)
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw error;
    const value = page ?? null;
    await writeEdgeCache(data.slug, value);
    return value;
  });
