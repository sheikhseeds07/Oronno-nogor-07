import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "https://frtzlibogmethppqmhtr.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  for (const bucket of buckets || []) {
    if (!bucket.public) {
      console.log(`[skip] ${bucket.name} already private`);
      continue;
    }

    const { error: updateError } = await supabase.storage.updateBucket(bucket.id, {
      public: false,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    });
    if (updateError) throw new Error(`${bucket.name}: ${updateError.message}`);
    console.log(`[private] ${bucket.name}`);
  }

  console.log("All Supabase Storage buckets are private.");
}

main().catch((error) => {
  console.error("[storage-lock fatal]", error);
  process.exitCode = 1;
});
