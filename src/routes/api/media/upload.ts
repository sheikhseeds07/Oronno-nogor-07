import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/personal-supabase/db.types";
import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "@/lib/personal-supabase/client";

// Keep every public/admin-managed image class on the R2 upload path so new
// media never falls back to Supabase Storage.
const STAFF_BUCKETS = new Set([
  "banners",
  "category-images",
  "product-images",
  "site-assets",
  "landing-images",
  "blog-images",
  "public-assets",
]);
const CUSTOMER_BUCKETS = new Set(["customer-profiles", "review-images", "community-media"]);
const ALLOWED_BUCKETS = new Set([...STAFF_BUCKETS, ...CUSTOMER_BUCKETS]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type R2BucketLike = {
  head: (key: string) => Promise<unknown | null>;
  put: (
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ) => Promise<unknown>;
};

function getR2Bucket(): R2BucketLike | undefined {
  const env = (globalThis as typeof globalThis & {
    __ORONNO_CF_ENV?: { MEDIA_BUCKET?: R2BucketLike };
  }).__ORONNO_CF_ENV;
  return env?.MEDIA_BUCKET;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}

function safeObjectPath(value: string): string | null {
  const path = value.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!path || path.length > 900 || path.includes("../") || path.includes("/..") || path.includes("\0")) return null;
  return path;
}

async function authenticatedClient(request: Request) {
  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const db = createClient<Database>(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        headers.set("apikey", LIVE_DATABASE_KEY);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  return { db, userId: String(userId) };
}

export const Route = createFileRoute("/api/media/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticatedClient(request);
        if (!auth) return json({ error: "Unauthorized" }, 401);

        const form = await request.formData().catch(() => null);
        if (!form) return json({ error: "Invalid form data" }, 400);

        const bucketName = String(form.get("bucket") ?? "").trim();
        const objectPath = safeObjectPath(String(form.get("path") ?? ""));
        const file = form.get("file");
        const upsert = String(form.get("upsert") ?? "false") === "true";

        if (!ALLOWED_BUCKETS.has(bucketName)) return json({ error: "Bucket not allowed" }, 400);
        if (!objectPath) return json({ error: "Invalid object path" }, 400);
        if (!(file instanceof File)) return json({ error: "File missing" }, 400);
        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return json({ error: "File size not allowed" }, 413);

        if (CUSTOMER_BUCKETS.has(bucketName) && !objectPath.startsWith(`${auth.userId}/`)) {
          return json({ error: "Invalid customer object path" }, 403);
        }

        if (STAFF_BUCKETS.has(bucketName)) {
          const { data: roles, error } = await auth.db
            .from("user_roles")
            .select("role")
            .eq("user_id", auth.userId);
          if (error) return json({ error: "Authorization failed" }, 403);
          const staff = (roles ?? []).some((row) => ["super_admin", "admin", "employee"].includes(String(row.role)));
          if (!staff) return json({ error: "Staff only" }, 403);
        }

        const bucket = getR2Bucket();
        if (!bucket) return json({ error: "R2 binding unavailable" }, 503);

        const key = `${bucketName}/${objectPath}`;
        if (!upsert) {
          const existing = await bucket.head(key);
          if (existing) return json({ error: "Object already exists" }, 409);
        }

        await bucket.put(key, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
            cacheControl: "public, max-age=31536000, immutable",
          },
        });

        return json({
          ok: true,
          key,
          url: `/media?asset=${encodeURIComponent(key)}`,
        });
      },
    },
  },
});
