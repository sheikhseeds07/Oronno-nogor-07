import { supabase } from "@/lib/personal-supabase/client";

// Buckets in this workspace are private, so a "public URL" would 400.
// Upload, then hand back a long-lived signed URL (10 years) that any
// visitor can load.
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  opts?: { upsert?: boolean },
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: opts?.upsert ?? false,
    contentType: file.type || undefined,
    cacheControl: String(ONE_YEAR),
  });
  if (error) throw new Error(error.message);

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || "URL তৈরি হয়নি");
  return data.signedUrl;
}

export function safeFileName(name: string) {
  return `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
