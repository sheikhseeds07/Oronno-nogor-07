import { createFileRoute } from "@tanstack/react-router";
import { getCloudflareR2Bucket } from "@/lib/cloudflare-r2.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/personal-supabase/db.types";
import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "@/lib/personal-supabase/client";

type ManifestItem = {
  bucket: string;
  path: string;
  size?: number;
  content_type?: string;
};

type Manifest = {
  total: number;
  offset: number;
  limit: number;
  items: ManifestItem[];
};

type R2BucketLike = {
  head: (key: string) => Promise<unknown | null>;
  put: (
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ) => Promise<unknown>;
};

function getR2Bucket(): R2BucketLike | undefined {
  return getCloudflareR2Bucket<R2BucketLike>();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "CDN-Cache-Control": "private, no-store",
      "Cloudflare-CDN-Cache-Control": "private, no-store",
    },
  });
}

function asInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

export const Route = createFileRoute("/api/internal/r2-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-r2-migration-secret") ?? "";
        if (!secret) return json({ error: "Unauthorized" }, 401);

        let payload: { offset?: unknown; limit?: unknown; mode?: unknown } = {};
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const offset = asInt(payload.offset, 0, 0, 1_000_000);
        const limit = asInt(payload.limit, 10, 1, 25);
        const mode = payload.mode === "verify" ? "verify" : "copy";

        const db = createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data, error } = await db.rpc("get_r2_storage_manifest" as never, {
          p_secret: secret,
          p_offset: offset,
          p_limit: limit,
        } as never);

        if (error || !data || typeof data !== "object") {
          return json({ error: error?.message || "Migration manifest unavailable" }, 403);
        }

        const manifest = data as unknown as Manifest;
        const bucket = getR2Bucket();
        if (!bucket) return json({ error: "R2 binding unavailable" }, 503);

        const copied: string[] = [];
        const existing: string[] = [];
        const missing: string[] = [];
        const failures: Array<{ key: string; error: string }> = [];

        for (const item of manifest.items ?? []) {
          const key = `${item.bucket}/${item.path}`;

          try {
            const present = await bucket.head(key);
            if (mode === "verify") {
              if (present) existing.push(key);
              else missing.push(key);
              continue;
            }

            if (present) {
              existing.push(key);
              continue;
            }

            const source = new URL(`${LIVE_DATABASE_URL}/functions/v1/r2-source-proxy`);
            source.searchParams.set("bucket", item.bucket);
            source.searchParams.set("path", item.path);

            const origin = await fetch(source.toString(), {
              method: "GET",
              headers: { "x-r2-migration-secret": secret },
            });

            if (!origin.ok) {
              failures.push({
                key,
                error: `source HTTP ${origin.status}: ${(await origin.text()).slice(0, 200)}`,
              });
              continue;
            }

            const body = await origin.arrayBuffer();
            await bucket.put(key, body, {
              httpMetadata: {
                contentType:
                  origin.headers.get("content-type") ||
                  item.content_type ||
                  "application/octet-stream",
                cacheControl: "public, max-age=31536000, immutable",
              },
            });

            const verified = await bucket.head(key);
            if (!verified) {
              failures.push({ key, error: "R2 verification failed" });
              continue;
            }
            copied.push(key);
          } catch (copyError) {
            failures.push({
              key,
              error: copyError instanceof Error ? copyError.message : "Unknown migration error",
            });
          }
        }

        const nextOffset = offset + (manifest.items?.length ?? 0);
        return json(
          {
            ok: failures.length === 0,
            mode,
            total: manifest.total,
            offset,
            limit,
            processed: manifest.items?.length ?? 0,
            next_offset: nextOffset,
            done: nextOffset >= manifest.total,
            copied,
            existing,
            missing,
            failures,
          },
          failures.length ? 207 : 200,
        );
      },
    },
  },
});
