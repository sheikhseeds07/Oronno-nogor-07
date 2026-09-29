import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
const r2Bucket = process.env.R2_BUCKET || "ecom-products";
const sourceBuckets = (process.env.MIGRATE_BUCKETS || "product-images")
  .split(",").map((x) => x.trim()).filter(Boolean);
const cacheControl = "public, max-age=31536000";

function need(name, value) {
  if (!value) throw new Error(name + " is required");
  return value;
}
need("SUPABASE_URL", supabaseUrl);
need("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
need("R2_PUBLIC_URL", publicBase);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function wrangler(args, capture = false) {
  return execFileSync("npx", ["wrangler", ...args], {
    env: process.env,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}

function ensureBucket() {
  const list = String(wrangler(["r2", "bucket", "list"], true));
  if (list.includes(r2Bucket)) return;
  wrangler(["r2", "bucket", "create", r2Bucket]);
}

async function listAll(bucket, path = "") {
  const out = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(path, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const rows = data || [];
    for (const item of rows) {
      if (!item.metadata) out.push(...await listAll(bucket, path + item.name + "/"));
      else out.push({ path: path + item.name, metadata: item.metadata || {} });
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return out;
}

ensureBucket();
mkdirSync(resolve("backups"), { recursive: true });
const tempRoot = mkdtempSync(join(tmpdir(), "supabase-r2-"));
const manifest = [];
let failed = 0;

try {
  for (const sourceBucket of sourceBuckets) {
    const files = await listAll(sourceBucket);
    console.log(sourceBucket + ": " + files.length + " objects");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { data, error } = await supabase.storage.from(sourceBucket).download(file.path);
      if (error || !data) {
        failed++;
        console.error("Download failed:", sourceBucket + "/" + file.path, error?.message || "no data");
        continue;
      }

      const bytes = Buffer.from(await data.arrayBuffer());
      const tempPath = join(tempRoot, "object-" + i);
      writeFileSync(tempPath, bytes);
      const r2Key = sourceBucket + "/" + file.path;
      const mime = file.metadata?.mimetype || data.type || "application/octet-stream";

      try {
        wrangler([
          "r2", "object", "put", r2Bucket + "/" + r2Key,
          "--file", tempPath,
          "--content-type", mime,
          "--cache-control", cacheControl,
          "--remote",
          "--force",
        ]);
        manifest.push({
          source_bucket: sourceBucket,
          source_path: file.path,
          r2_bucket: r2Bucket,
          r2_key: r2Key,
          bytes: bytes.byteLength,
          content_type: mime,
          cache_control: cacheControl,
          public_url: publicBase + "/" + r2Key.split("/").map(encodeURIComponent).join("/"),
        });
      } catch (error) {
        failed++;
        console.error("Upload failed:", r2Key, error instanceof Error ? error.message : error);
      }
    }
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

writeFileSync(resolve("backups/r2_migration_manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

if (failed) {
  console.error("R2 migration incomplete. Failed objects: " + failed + ". Do not switch media delivery.");
  process.exit(1);
}
console.log("R2 migration complete. Objects uploaded: " + manifest.length);
console.log("Keep Supabase Storage untouched until the R2 domain and application are verified.");
