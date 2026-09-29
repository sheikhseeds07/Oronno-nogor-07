import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { uploadToR2 } from "@/lib/r2";
import { LIVE_DATABASE_KEY, LIVE_DATABASE_URL } from "@/lib/personal-supabase/client";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const STAFF_BUCKETS = new Set(["product-images", "category-images", "banners", "site-assets"]);
const CUSTOMER_BUCKETS = new Set(["review-images", "customer-profiles"]);

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization")?.trim() || "";
  if (!header.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new Response("Unauthorized", { status: 401 });
  return token;
}

function normalizeObjectPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!normalized || normalized.length > 600 || normalized.split("/").some((part) => part === "..")) {
    throw new Response("Invalid object path", { status: 400 });
  }
  return normalized;
}

async function authorizeUpload(request: Request, bucket: string, path: string) {
  const token = bearerToken(request);
  const auth = createClient(LIVE_DATABASE_URL, LIVE_DATABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await auth.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) throw new Response("Unauthorized", { status: 401 });

  if (CUSTOMER_BUCKETS.has(bucket)) {
    if (!path.startsWith(`${user.id}/`)) {
      throw new Response("Forbidden", { status: 403 });
    }
    return;
  }

  if (!STAFF_BUCKETS.has(bucket)) throw new Response("Bucket not allowed", { status: 400 });

  const { data: roleRow, error: roleError } = await auth
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleRow || !["super_admin", "admin", "employee"].includes(String(roleRow.role))) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const Route = createFileRoute("/api/media/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const bucket = String(form.get("bucket") || "").trim();
          const rawPath = String(form.get("path") || "").trim();
          const file = form.get("file");

          if (!bucket || !(file instanceof File)) {
            return Response.json({ error: "bucket, path and file are required" }, { status: 400 });
          }
          if (!file.type.startsWith("image/")) {
            return Response.json({ error: "Only image uploads are allowed" }, { status: 415 });
          }
          if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
            return Response.json({ error: "Image must be between 1 byte and 8MB" }, { status: 413 });
          }

          const path = normalizeObjectPath(rawPath);
          await authorizeUpload(request, bucket, path);

          const key = `${bucket}/${path}`;
          const url = await uploadToR2(Buffer.from(await file.arrayBuffer()), key, file.type || "image/webp");

          return Response.json(
            { url, key },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("[r2-upload]", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Upload failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
