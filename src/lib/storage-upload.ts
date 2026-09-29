import { supabase } from "@/lib/personal-supabase/client";

// Images are stored in the private site-assets bucket and served through the
// same-domain /media cache. Uploads are aggressively optimized client-side so
// even very large originals become compact WebP files before Storage receives them.
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ONE_YEAR = 60 * 60 * 24 * 365;
const MAX_IMAGE_DIMENSION = 1400;
const WEBP_QUALITY = 0.76;
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SUPABASE_STORAGE_HOSTS = new Set(["bvuhvzccziuniujeogng.supabase.co", "frtzlibogmethppqmhtr.supabase.co"]);

function throughMediaCache(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      SUPABASE_STORAGE_HOSTS.has(parsed.hostname) &&
      parsed.pathname.startsWith("/storage/v1/")
    ) return `/media?src=${encodeURIComponent(url)}`;
  } catch {}
  return url;
}

type PreparedUpload = { path: string; file: File };

function replaceExtension(path: string, extension: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? `${path.slice(0, dot)}.${extension}` : `${path}.${extension}`;
}

async function optimizeImageUpload(path: string, file: File): Promise<PreparedUpload> {
  if (!OPTIMIZABLE_IMAGE_TYPES.has(file.type) || typeof document === "undefined" || typeof createImageBitmap !== "function") {
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob) return { path, file };

    // Always prefer the optimized WebP when it is smaller. Large uploads are
    // resized to 1400px max and compressed at a visually high quality.
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
  const prepared = await optimizeImageUpload(path, file);
  const { error } = await supabase.storage.from(bucket).upload(prepared.path, prepared.file, {
    upsert: opts?.upsert ?? false,
    contentType: prepared.file.type || undefined,
    cacheControl: String(ONE_YEAR),
  });
  if (error) throw new Error(error.message);

  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(prepared.path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "URL তৈরি হয়নি");
  return throughMediaCache(data.signedUrl);
}

export function safeFileName(name: string) {
  return `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
