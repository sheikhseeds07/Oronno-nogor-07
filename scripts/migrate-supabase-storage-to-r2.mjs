import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://frtzlibogmethppqmhtr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_API_TOKEN_R2;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "a91d9451c87479d4d01d2d2add2530f5";
const R2_BUCKET = "oronnonogor-media";
const R2_ENDPOINT = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const PAGE_SIZE = 1000;
const TMP = path.resolve(".r2-migration-tmp");

if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!R2_ACCESS_KEY_ID) throw new Error("Missing CLOUDFLARE_R2_ACCESS_KEY_ID");
if (!R2_SECRET_ACCESS_KEY) throw new Error("Missing CLOUDFLARE_API_TOKEN_R2");

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

  if (!res.ok) {
    throw new Error(`Storage metadata list failed: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

async function downloadObject(bucket, name) {
  const visibility =
    bucket === "community-media" ||
    bucket === "customer-profiles" ||
    bucket === "review-images"
      ? "public"
      : "authenticated";

  const bucketUrl = `${SUPABASE_URL}/storage/v1/object/${visibility}/${encodeURIComponent(bucket)}`;
  const url = `${bucketUrl}/${name.split("/").map(encodeURIComponent).join("/")}`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Download failed for ${bucket}/${name}: ${res.status}`);
  }

  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

function upload(localFile, key, contentType) {
  execFileSync(
    "aws",
    [
      "s3",
      "cp",
      localFile,
      `s3://${R2_BUCKET}/${key}`,
      "--endpoint-url",
      R2_ENDPOINT,
      "--region",
      "auto",
      "--content-type",
      contentType,
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--no-progress",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
      },
    },
  );
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
