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

const migratedKeys = new Set();
const failures = [];

const authHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

async function listPrefix(bucket, prefix = "") {
  const out = [];
  let offset = 0;

  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });

    if (!res.ok) {
      throw new Error(`Storage list failed for ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  return out;
}

async function listBucketObjects(bucket, prefix = "") {
  const rows = await listPrefix(bucket, prefix);
  const objects = [];

  for (const row of rows) {
    const name = String(row?.name ?? "").replace(/^\/+/, "");
    if (!name) continue;
    const full = prefix ? `${prefix}/${name}` : name;

    // Storage list returns virtual folders with no object id/metadata.
    if (!row?.id || row?.metadata == null) {
      objects.push(...await listBucketObjects(bucket, full));
      continue;
    }
    objects.push({ bucket, name: full, metadata: row.metadata ?? {} });
  }

  return objects;
}

async function downloadObject(bucket, name) {
  const encoded = name.split("/").map(encodeURIComponent).join("/");
  const candidates = [
    `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`,
    `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`,
  ];

  let lastStatus = 0;
  for (const url of candidates) {
    const res = await fetch(url, { headers: authHeaders });
    lastStatus = res.status;
    if (!res.ok) continue;
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }
  throw new Error(`Download failed for ${bucket}/${name}: ${lastStatus}`);
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
        AWS_DEFAULT_REGION: "auto",
      },
    },
  );
}

function storageKeyFromUrl(value) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("/media?asset=")) {
    try {
      const u = new URL(value, "https://sheikhseeds.com");
      return u.searchParams.get("asset");
    } catch {
      return null;
    }
  }

  let raw = value;
  try {
    const wrapper = new URL(value, "https://sheikhseeds.com");
    if (wrapper.pathname === "/media") {
      const inner = wrapper.searchParams.get("src");
      if (inner) raw = inner;
    }
  } catch {}

  try {
    const u = new URL(raw);
    if (!/\.supabase\.co$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    const objectPath = m[2].split("/").map((part) => {
      try { return decodeURIComponent(part); } catch { return part; }
    }).join("/");
    return `${bucket}/${objectPath}`;
  } catch {
    return null;
  }
}

function rewriteUrl(value) {
  const key = storageKeyFromUrl(value);
  if (!key || !migratedKeys.has(key)) return value;
  return `/media?asset=${encodeURIComponent(key)}`;
}

function rewriteValue(value) {
  if (typeof value === "string") return rewriteUrl(value);
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteValue(v)]));
  }
  return value;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readRows(table, columns) {
  const rows = [];
  let offset = 0;
  while (true) {
    const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    u.searchParams.set("select", ["id", ...columns].join(","));
    u.searchParams.set("limit", String(PAGE_SIZE));
    u.searchParams.set("offset", String(offset));
    const res = await fetch(u, { headers: authHeaders });
    if (!res.ok) throw new Error(`DB read failed for ${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function patchRow(table, id, patch) {
  const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  u.searchParams.set("id", `eq.${id}`);
  const res = await fetch(u, {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`DB update failed for ${table}/${id}: ${res.status} ${await res.text()}`);
}

async function rewriteDatabaseReferences() {
  const specs = [
    ["products", ["images"]],
    ["categories", ["image_url"]],
    ["banners", ["image_url"]],
    ["landing_pages", ["hero_image", "gallery_images"]],
    ["customer_profiles", ["avatar_url", "cover_url"]],
    ["profiles", ["avatar_url"]],
    ["product_reviews", ["image_urls", "author_avatar"]],
    ["product_questions", ["author_avatar"]],
    ["fb_trainer_messages", ["image_url"]],
    ["site_settings", ["settings"]],
  ];

  let changedRows = 0;
  for (const [table, columns] of specs) {
    const rows = await readRows(table, columns);
    for (const row of rows) {
      const patch = {};
      for (const column of columns) {
        const next = rewriteValue(row[column]);
        if (!sameValue(next, row[column])) patch[column] = next;
      }
      if (Object.keys(patch).length === 0) continue;
      await patchRow(table, row.id, patch);
      changedRows++;
    }
    console.log(`[DB] ${table}: scanned=${rows.length} changed_total=${changedRows}`);
  }
  return changedRows;
}

await mkdir(TMP, { recursive: true });

let scanned = 0;
let uploaded = 0;

for (const bucket of buckets) {
  const objects = await listBucketObjects(bucket);
  console.log(`[BUCKET] ${bucket}: objects=${objects.length}`);

  for (const row of objects) {
    scanned++;
    const key = `${row.bucket}/${row.name}`;
    const safeName = Buffer.from(key).toString("base64url").replace(/[^a-zA-Z0-9_-]/g, "_");
    const localFile = path.join(TMP, safeName);

    try {
      const file = await downloadObject(row.bucket, row.name);
      await writeFile(localFile, file.bytes);
      upload(localFile, key, file.contentType);
      migratedKeys.add(key);
      uploaded++;
      console.log(`[R2] ${uploaded}/${scanned} ${key}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ key, message });
      console.error(`[FAILED] ${key}: ${message}`);
    } finally {
      await rm(localFile, { force: true });
    }
  }
}

const changedRows = await rewriteDatabaseReferences();
await rm(TMP, { recursive: true, force: true });

console.log(JSON.stringify({
  scanned,
  uploaded,
  failed: failures.length,
  db_rows_rewritten: changedRows,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 2;
