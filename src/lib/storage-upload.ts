import { supabase } from "@/lib/personal-supabase/client";

// All new website media is uploaded straight to Cloudflare R2.
// Normalize large raster uploads to WebP before they reach R2. The bucket
// policy keeps product files compact while preserving enough pixels for detail views.
const IMAGE_POLICIES: Record<string, { maxDimension: number; quality: number }> = {
  "product-images": { maxDimension: 1200, quality: 0.8 },
  "category-images": { maxDimension: 1000, quality: 0.8 },
  "banners": { maxDimension: 1920, quality: 0.82 },
  "landing-images": { maxDimension: 1600, quality: 0.8 },
  "blog-images": { maxDimension: 1600, quality: 0.8 },
  "customer-profiles": { maxDimension: 800, quality: 0.78 },
  "review-images": { maxDimension: 1200, quality: 0.8 },
};
const DEFAULT_IMAGE_POLICY = { maxDimension: 1400, quality: 0.8 };
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

type PreparedUpload = { path: string; file: File };

function replaceExtension(path: string, extension: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? `${path.slice(0, dot)}.${extension}` : `${path}.${extension}`;
}

async function optimizeImageUpload(bucket: string, path: string, file: File): Promise<PreparedUpload> {
  if (!OPTIMIZABLE_IMAGE_TYPES.has(file.type) || typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { path, file };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const policy = IMAGE_POLICIES[bucket] ?? DEFAULT_IMAGE_POLICY;
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, policy.maxDimension / largestSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return { path, file };
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", policy.quality));
    if (!blob) return { path, file };

    if (blob.size < file.size) {
      return {
        path: replaceExtension(path, "webp"),
        file: new File([blob], replaceExtension(file.name, "webp").split("/").pop() || "image.webp", {
          type: "image/webp",
          lastModified: file.lastModified,
        }),
      };
    }
  } catch {
    // Keep the original when a browser cannot decode/convert the image.
  } finally {
    bitmap?.close();
  }
  return { path, file };
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  opts?: { upsert?: boolean },
): Promise<string> {
  const prepared = await optimizeImageUpload(bucket, path, file);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("আপলোড করতে লগইন করুন");

  const form = new FormData();
  form.set("bucket", bucket);
  form.set("path", prepared.path);
  form.set("upsert", String(opts?.upsert ?? false));
  form.set("file", prepared.file, prepared.file.name);

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || "R2 upload failed");
  }
  return payload.url;
}

export function safeFileName(name: string) {
  return `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
