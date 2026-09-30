import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://frtzlibogmethppqmhtr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID ||
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  "a91d9451c87479d4d01d2d2add2530f5";
const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID ||
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ||
  process.env.CLOUDFLARE_API_TOKEN_R2;
const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME ||
  process.env.R2_BUCKET ||
  "sheikhseeds";
const R2_PUBLIC_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_R2_URL ||
  ""
).replace(/\/+$/, "");

const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const TMP = path.resolve(".r2-migration-tmp");
const PAGE_SIZE = 1000;

if (!DRY_RUN) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  if (!R2_ACCESS_KEY_ID) throw new Error("Missing R2_ACCESS_KEY_ID / CLOUDFLARE_R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) throw new Error("Missing R2_SECRET_ACCESS_KEY / CLOUDFLARE_API_TOKEN_R2");
}

if (R2_PUBLIC_URL) {
  const publicHost = new URL(R2_PUBLIC_URL).hostname.toLowerCase();
  if (publicHost === "sheikhseeds.com" || publicHost === "www.sheikhseeds.com") {
    throw new Error(
      "Refusing unsafe R2 public URL. Never attach R2 to sheikhseeds.com or www.sheikhseeds.com; use r2.sheikhseeds.com, an r2.dev URL, or leave NEXT_PUBLIC_R2_PUBLIC_URL empty to use /media?asset=...",
    );
  }
}

const storageBuckets = [
  "product-images",
  "category-images",
  "banners",
  "landing-images",
];

const localRoots = [
  { root: path.resolve("public"), keyPrefix: "public-assets" },
  { root: path.resolve("src/assets"), keyPrefix: "public-assets/src-assets" },
];

const mediaExt = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".ico",
  ".mp4", ".webm", ".mov", ".m4v", ".mp3", ".wav", ".ogg",
]);

const migratedKeys = new Set<string>();
const failures: Array<{ key: string; message: string }> = [];
const authHeaders: Record<string, string> = SUPABASE_SERVICE_ROLE_KEY
  ? {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    }
  : {};

function awsEnv() {
  return {
    ...process.env,
    AWS_ACCESS_KEY_ID: R2_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY!,
    AWS_DEFAULT_REGION: "auto",
  };
}

function assertBucketExists() {
  if (DRY_RUN && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)) {
    console.log("[DRY-RUN] R2 credential check skipped; no upload will be attempted.");
    return;
  }
  try {
    execFileSync(
      "aws",
      ["s3", "ls", `s3://${R2_BUCKET_NAME}`, "--endpoint-url", R2_ENDPOINT, "--region", "auto"],
      { stdio: "pipe", env: awsEnv() },
    );
  } catch (error) {
    throw new Error(
      `R2 bucket "${R2_BUCKET_NAME}" is not accessible. wrangler.jsonc should bind MEDIA_BUCKET to this bucket. Create it in Cloudflare R2 before migration. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function listPrefix(bucket: string, prefix = ""): Promise<any[]> {
  const out: any[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          prefix,
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      },
    );
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(
        `Storage list failed for ${bucket}/${prefix}: ${res.status} ${await res.text()}`,
      );
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function listBucketObjects(bucket: string, prefix = ""): Promise<Array<{ bucket: string; name: string }>> {
  const rows = await listPrefix(bucket, prefix);
  const objects: Array<{ bucket: string; name: string }> = [];
  for (const row of rows) {
    const name = String(row?.name ?? "").replace(/^\/+/, "");
    if (!name) continue;
    const full = prefix ? `${prefix}/${name}` : name;
    if (!row?.id || row?.metadata == null) {
      objects.push(...(await listBucketObjects(bucket, full)));
      continue;
    }
    objects.push({ bucket, name: full });
  }
  return objects;
}

async function downloadObject(bucket: string, name: string) {
  const encoded = name.split("/").map(encodeURIComponent).join("/");
  const candidates = [
    `${SUPABASE_URL}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`,
    `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encoded}`,
  ];

  for (const url of candidates) {
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) continue;
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "application/octet-stream",
    };
  }

  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encoded}`,
    {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (signRes.ok) {
    const signed = await signRes.json().catch(() => ({} as any));
    const signedPath = signed?.signedURL || signed?.signedUrl;
    if (signedPath) {
      const signedUrl = String(signedPath).startsWith("http")
        ? String(signedPath)
        : String(signedPath).startsWith("/storage/v1/")
          ? `${SUPABASE_URL}${signedPath}`
          : `${SUPABASE_URL}/storage/v1${signedPath}`;
      const res = await fetch(signedUrl);
      if (res.ok) {
        return {
          bytes: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get("content-type") || "application/octet-stream",
        };
      }
    }
  }

  throw new Error(`Download failed for ${bucket}/${name}`);
}

function uploadFile(localFile: string, key: string, contentType?: string) {
  const args = [
    "s3", "cp", localFile, `s3://${R2_BUCKET_NAME}/${key}`,
    "--endpoint-url", R2_ENDPOINT,
    "--region", "auto",
    "--cache-control", "public, max-age=31536000, immutable",
    "--no-progress",
  ];
  if (contentType) args.push("--content-type", contentType);
  execFileSync("aws", args, { stdio: "inherit", env: awsEnv() });
}

function extensionContentType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  } as Record<string, string>)[ext];
}

async function walk(root: string, current = root): Promise<string[]> {
  try {
    const entries = await readdir(current, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(root, full)));
      else if (entry.isFile() && mediaExt.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
    return out;
  } catch {
    return [];
  }
}

function storageKeyFromUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("/media?asset=")) {
    try {
      return new URL(value, "https://sheikhseeds.com").searchParams.get("asset");
    } catch {
      return null;
    }
  }

  let raw = value;
  try {
    const wrapper = new URL(value, "https://sheikhseeds.com");
    if (wrapper.pathname === "/media") {
      const direct = wrapper.searchParams.get("asset");
      if (direct) return direct;
      const inner = wrapper.searchParams.get("src");
      if (inner) raw = inner;
    }
  } catch {}

  try {
    const u = new URL(raw);
    if (!/\.supabase\.co$/i.test(u.hostname)) return null;
    const match = u.pathname.match(
      /^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (!match) return null;
    const bucket = decodeURIComponent(match[1]);
    const objectPath = match[2]
      .split("/")
      .map((part) => {
        try { return decodeURIComponent(part); } catch { return part; }
      })
      .join("/");
    return `${bucket}/${objectPath}`;
  } catch {
    return null;
  }
}

function r2UrlForKey(key: string): string {
  return R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL}/${key.split("/").map(encodeURIComponent).join("/")}`
    : `/media?asset=${encodeURIComponent(key)}`;
}

function rewriteValue(value: unknown): unknown {
  if (typeof value === "string") {
    const key = storageKeyFromUrl(value);
    return key && migratedKeys.has(key) ? r2UrlForKey(key) : value;
  }
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, rewriteValue(v)]),
    );
  }
  return value;
}

async function readRows(table: string, columns: string[]) {
  const rows: any[] = [];
  let offset = 0;
  while (true) {
    const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    u.searchParams.set("select", ["id", ...columns].join(","));
    u.searchParams.set("limit", String(PAGE_SIZE));
    u.searchParams.set("offset", String(offset));
    const res = await fetch(u, { headers: authHeaders });
    if (res.status === 404 || res.status === 400) {
      console.warn(`[DB] skipping ${table}: ${res.status} ${await res.text()}`);
      return [];
    }
    if (!res.ok) throw new Error(`DB read failed for ${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function patchRow(table: string, id: string, patch: Record<string, unknown>) {
  const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  u.searchParams.set("id", `eq.${id}`);
  const res = await fetch(u, {
    method: "PATCH",
    headers: { ...authHeaders, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`DB update failed for ${table}/${id}: ${res.status} ${await res.text()}`);
}

async function rewriteDatabaseReferences() {
  const specs: Array<[string, string[]]> = [
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
    let tableChanges = 0;
    for (const row of rows) {
      const patch: Record<string, unknown> = {};
      for (const column of columns) {
        const next = rewriteValue(row[column]);
        if (JSON.stringify(next) !== JSON.stringify(row[column])) patch[column] = next;
      }
      if (!Object.keys(patch).length) continue;
      await patchRow(table, row.id, patch);
      changedRows++;
      tableChanges++;
    }
    console.log(`[DB] ${table}: scanned=${rows.length} changed=${tableChanges}`);
  }
  return changedRows;
}

async function migrateSupabaseStorage() {
  let scanned = 0;
  let uploaded = 0;
  let wouldUpload = 0;

  if (DRY_RUN && !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[DRY-RUN] Supabase object listing skipped because SUPABASE_SERVICE_ROLE_KEY is not set.");
    return { scanned, uploaded, wouldUpload };
  }

  for (const bucket of storageBuckets) {
    let objects: Array<{ bucket: string; name: string }> = [];
    try {
      objects = await listBucketObjects(bucket);
    } catch (error) {
      console.warn(`[BUCKET] ${bucket}: skipped - ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    console.log(`[BUCKET] ${bucket}: objects=${objects.length}`);
    for (const row of objects) {
      scanned++;
      const key = `${row.bucket}/${row.name}`;

      if (DRY_RUN) {
        wouldUpload++;
        console.log(`[DRY-RUN] Supabase ${row.bucket}/${row.name} -> r2://${R2_BUCKET_NAME}/${key}`);
        continue;
      }

      const safeName = Buffer.from(key).toString("base64url");
      const localFile = path.join(TMP, safeName);

      try {
        const file = await downloadObject(row.bucket, row.name);
        await writeFile(localFile, file.bytes);
        uploadFile(localFile, key, file.contentType);
        migratedKeys.add(key);
        uploaded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ key, message });
        console.error(`[FAILED] ${key}: ${message}`);
      } finally {
        await rm(localFile, { force: true });
      }
    }
  }
  return { scanned, uploaded, wouldUpload };
}

async function migrateLocalAssets() {
  let scanned = 0;
  let uploaded = 0;
  let wouldUpload = 0;
  for (const config of localRoots) {
    const files = await walk(config.root);
    for (const file of files) {
      const rel = path.relative(config.root, file).split(path.sep).join("/");
      const key = `${config.keyPrefix}/${rel}`;
      scanned++;
      try {
        const info = await stat(file);
        if (!info.size) continue;

        if (DRY_RUN) {
          wouldUpload++;
          const source = path.relative(process.cwd(), file).split(path.sep).join("/");
          console.log(`[DRY-RUN] ${source} -> r2://${R2_BUCKET_NAME}/${key}`);
          continue;
        }

        uploadFile(file, key, extensionContentType(file));
        migratedKeys.add(key);
        uploaded++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ key, message });
        console.error(`[FAILED] local ${key}: ${message}`);
      }
    }
  }
  return { scanned, uploaded, wouldUpload };
}

console.log(`[MODE] ${DRY_RUN ? "DRY RUN (no uploads, no DB writes)" : "LIVE MIGRATION"}`);
console.log(`[R2] bucket=${R2_BUCKET_NAME} public_url=${R2_PUBLIC_URL || "<blank; /media?asset=...>"}`);

if (!DRY_RUN) await mkdir(TMP, { recursive: true });
assertBucketExists();

const local = await migrateLocalAssets();
const storage = await migrateSupabaseStorage();
const changedRows = DRY_RUN ? 0 : await rewriteDatabaseReferences();

if (!DRY_RUN) await rm(TMP, { recursive: true, force: true });

console.log(JSON.stringify({
  dry_run: DRY_RUN,
  bucket: R2_BUCKET_NAME,
  endpoint: R2_ENDPOINT,
  public_url_mode: R2_PUBLIC_URL || "/media?asset=<key>",
  supabase_buckets: storageBuckets,
  local_assets_scanned: local.scanned,
  local_assets_would_upload: local.wouldUpload,
  local_assets_uploaded: local.uploaded,
  supabase_objects_scanned: storage.scanned,
  supabase_objects_would_upload: storage.wouldUpload,
  supabase_objects_uploaded: storage.uploaded,
  db_rows_rewritten: changedRows,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 2;
