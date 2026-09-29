import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://frtzlibogmethppqmhtr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "a91d9451c87479d4d01d2d2add2530f5";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const R2_BUCKET = "oronnonogor-media";
const PAGE_SIZE = 1000;
const TMP = path.resolve(".r2-migration-tmp");

if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!CF_API_TOKEN) throw new Error("Missing CLOUDFLARE_API_TOKEN");

const buckets = [
  "banners",
  "category-images",
  "community-media",
  "customer-profiles",
  "product-images",
  "review-images",
  "site-assets",
];

async function listObjects(offset) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/storage.objects`);
  url.searchParams.set("select", "bucket_id,name,metadata");
  url.searchParams.set("order", "id.asc");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Storage metadata list failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function downloadObject(bucket, name) {
  const bucketUrl = `${SUPABASE_URL}/storage/v1/object/${bucket === "community-media" || bucket === "customer-profiles" || bucket === "review-images" ? "public" : "authenticated"}/${encodeURIComponent(bucket)}`;\n  const url = `${bucketUrl}/${name.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Download failed for ${bucket}/${name}: ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "application/octet-stream" };
}

function upload(localFile, key, contentType) {
  const objectPath = `${R2_BUCKET}/${key}`;
  execFileSync("npx", [
    "--yes", "wrangler@latest", "r2", "object", "put", objectPath,
    "--file", localFile,
    "--remote",
    "--content-type", contentType,
    "--cache-control", "public, max-age=31536000, immutable",
    "--force",
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: CF_API_TOKEN,
    },
  });
}

await mkdir(TMP, { recursive: true });

let offset = 0;
let total = 0;
let uploaded = 0;
const failures = [];

while (true) {
  const rows = await listObjects(offset);
  if (!Array.isArray(rows) || rows.length === 0) break;

  for (const row of rows) {
    if (!buckets.includes(row.bucket_id)) continue;
    total++;
    const key = `${row.bucket_id}/${row.name}`;
    const safeName = Buffer.from(key).toString("base64url").replace(/[^a-zA-Z0-9_-]/g, "_");
    const localFile = path.join(TMP, safeName);

    try {
      const file = await downloadObject(row.bucket_id, row.name);
      await writeFile(localFile, file.bytes);
      upload(localFile, key, file.contentType);
      uploaded++;
      console.log(`[R2] ${uploaded}/${total} ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ key, message });
      console.error(`[FAILED] ${key}: ${message}`);
    } finally {
      await rm(localFile, { force: true });
    }
  }

  offset += rows.length;
  console.log(`[PAGE] offset=${offset} scanned=${total} uploaded=${uploaded} failures=${failures.length}`);
  if (rows.length < PAGE_SIZE) break;
}

console.log(JSON.stringify({ scanned: total, uploaded, failures }, null, 2));
if (failures.length) process.exitCode = 2;
