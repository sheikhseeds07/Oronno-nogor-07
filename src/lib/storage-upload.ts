import { supabase } from "@/lib/personal-supabase/client";

// Buckets in this workspace are private, so a "public URL" would 400.
// Upload, then create a long-lived signed origin URL. The returned URL is
// wrapped by the same-domain Cloudflare /media cache so public visitors do
// not fetch images directly from Supabase Storage.
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ONE_YEAR = 60 * 60 * 24 * 365;
const IMAGE_OPTIMIZE_THRESHOLD = 120 * 1024;
const MAX_IMAGE_DIMENSION = 1400;
const WEBP_QUALITY = 0.76;
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const SUPABASE_STORAGE_HOST = "bvuhvzccziuniujeogng.supabase.co";

function throughMediaCache(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname === SUPABASE_STORAGE_HOST &&
      parsed.pathname.startsWith("/storage/v1/")
    ) {
      return `/media?src=${encodeURIComponent(url)}`;
    }
  } catch {
    // Keep the original URL if it is not a standard absolute URL.
  }
  return url;
}

type PreparedUpload = {
  path: string;
  file: File;
};

function replaceExtension(path: string, extension: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  if (dot > slash) return `${path.slice(0, dot)}.${extension}`;
  return `${path}.${extension}`;
}

async function optimizeImageUpload(path: string, file: File): Promise<PreparedUpload> {
  if (
    file.size < IMAGE_OPTIMIZE_THRESHOLD ||
    !OPTIMIZABLE_IMAGE_TYPES.has(file.type) ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function"
  ) {
    return { path, file };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return { path, file };

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
    });

    // Only replace the upload when it materially reduces bytes. This preserves
    // already-efficient images while preventing multi-megabyte PNG/JPEG uploads
    // from becoming a recurring Storage egress cost.
    if (!blob || blob.size >= file.size * 0.95) return { path, file };

    const optimizedName = replaceExtension(file.name, "webp");
    return {
      path: replaceExtension(path, "webp"),
      file: new File([blob], optimizedName, {
        type: "image/webp",
        lastModified: file.lastModified,
      }),
    };
  } catch {
    // Upload reliability is more important than optimization. Unsupported or
    // malformed images continue through the existing upload path unchanged.
    return { path, file };
  } finally {
    bitmap?.close();
  }
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  opts?: { upsert?: boolean },
): Promise<string> {
  const prepared = await optimizeImageUpload(path, file);
  const { error } = await supabase.storage.from(bucket).upload(prepared.path, prepared.file, {
    upsert: opts?.upsert ?? false,
    contentType: prepared.file.type || undefined,
    cacheControl: String(ONE_YEAR),
  });
  if (error) throw new Error(error.message);

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(prepared.path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "URL তৈরি হয়নি");

  // Critical egress fix: never hand the raw Supabase Storage URL to the app.
  // The signed URL remains the private origin for the Worker, while browsers,
  // crawlers and Meta's in-app browser all hit the same Cloudflare cache key.
  return throughMediaCache(data.signedUrl);
}

export function safeFileName(name: string) {
  return `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
