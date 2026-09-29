import { supabase } from "@/lib/personal-supabase/client";

const MAX_IMAGE_DIMENSION = 800;
const WEBP_QUALITY = 0.8;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

type PreparedUpload = { path: string; file: File };

function replaceExtension(path: string, extension: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? `${path.slice(0, dot)}.${extension}` : `${path}.${extension}`;
}

async function optimizeImageUpload(path: string, file: File): Promise<PreparedUpload> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("ইমেজ 12MB-এর মধ্যে দিন");
  if (!OPTIMIZABLE_IMAGE_TYPES.has(file.type) || typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { path, file };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return { path, file };

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) return { path, file };

    const webpPath = replaceExtension(path, "webp");
    return {
      path: webpPath,
      file: new File([blob], replaceExtension(file.name, "webp").split("/").pop() || "image.webp", {
        type: "image/webp",
        lastModified: file.lastModified,
      }),
    };
  } catch {
    return { path, file };
  } finally {
    bitmap?.close();
  }
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  _opts?: { upsert?: boolean },
): Promise<string> {
  const prepared = await optimizeImageUpload(path, file);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) throw new Error("Upload করতে আবার লগইন করুন");

  const form = new FormData();
  form.set("bucket", bucket);
  form.set("path", prepared.path);
  form.set("file", prepared.file, prepared.file.name);

  const response = await fetch("/api/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error || `R2 upload failed (${response.status})`);
  }
  return payload.url;
}

export function safeFileName(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "") || "image";
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${suffix}-${clean}`;
}
