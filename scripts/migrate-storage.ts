import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { uploadToR2 } from "../src/lib/r2";

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || "https://frtzlibogmethppqmhtr.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const PAGE_SIZE = 1000;
const CONCURRENCY = 50;
const RETRIES = 3;
const LEGACY_HOST_RE = /\.supabase\.co$/i;

if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
if (!process.env.R2_PUBLIC_URL) process.env.R2_PUBLIC_URL = "https://images.sheikhseeds.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

type ProductRow = { id: string; images: string[] | null };
type ImageRow = { id: string; image_url: string | null };
type LegacyObject = { sourceUrl: string; bucket: string; objectPath: string };

function unwrapMediaUrl(value: string): string {
  try {
    const parsed = new URL(value, "https://sheikhseeds.com");
    if (parsed.pathname === "/media") {
      const src = parsed.searchParams.get("src");
      if (src) return src;
    }
  } catch {}
  return value;
}

function parseLegacyObject(value: string): LegacyObject | null {
  const sourceUrl = unwrapMediaUrl(value);
  try {
    const parsed = new URL(sourceUrl);
    if (!LEGACY_HOST_RE.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
      sourceUrl,
      bucket: decodeURIComponent(match[1]),
      objectPath: match[2].split("/").map(decodeURIComponent).join("/"),
    };
  } catch {
    return null;
  }
}

function isLegacyStorageUrl(value: string | null | undefined): boolean {
  return !!value && parseLegacyObject(value) !== null;
}

function fallbackKey(table: string, id: string, value: string, index = 0): string {
  let filename = `image-${index}.bin`;
  try {
    const parsed = new URL(unwrapMediaUrl(value));
    filename = decodeURIComponent(parsed.pathname.split("/").pop() || filename);
  } catch {}
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${table}/${id}-${filename}`;
}

function keyFor(value: string, table: string, id: string, index = 0): string {
  const legacy = parseLegacyObject(value);
  return legacy ? `${legacy.bucket}/${legacy.objectPath}` : fallbackKey(table, id, value, index);
}

async function withRetry<T>(label: string, work: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      console.warn(`[retry ${attempt}/${RETRIES}] ${label}: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

async function fetchLegacyBytes(value: string): Promise<{ bytes: Buffer; contentType: string }> {
  const legacy = parseLegacyObject(value);
  if (!legacy) throw new Error(`Not a Supabase Storage URL: ${value}`);

  try {
    const response = await fetch(legacy.sourceUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "sheikhseeds-r2-migrator/1.0" },
    });
    if (response.ok) {
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") || "application/octet-stream",
      };
    }
  } catch {}

  const { data, error } = await supabase.storage.from(legacy.bucket).download(legacy.objectPath);
  if (error || !data) throw new Error(error?.message || "Supabase Storage download failed");
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
}

async function optimize(bytes: Buffer, originalContentType: string) {
  if (!originalContentType.startsWith("image/")) return { bytes, contentType: originalContentType };
  try {
    const webp = await sharp(bytes)
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    return { bytes: webp, contentType: "image/webp" };
  } catch (error) {
    console.warn("[sharp] keeping original bytes:", error instanceof Error ? error.message : String(error));
    return { bytes, contentType: originalContentType };
  }
}

const urlCache = new Map<string, Promise<string>>();

function migrateUrl(value: string, table: string, id: string, index = 0): Promise<string> {
  if (!isLegacyStorageUrl(value)) return Promise.resolve(value);
  const source = unwrapMediaUrl(value);
  const cached = urlCache.get(source);
  if (cached) return cached;

  const job = withRetry(`${table}:${id}:${index}`, async () => {
    const { bytes, contentType } = await fetchLegacyBytes(value);
    const optimized = await optimize(bytes, contentType);
    const key = keyFor(value, table, id, index);
    const r2Url = await uploadToR2(optimized.bytes, key, optimized.contentType);
    console.log(`[ok] ${table} ${id} -> ${r2Url}`);
    return r2Url;
  });

  urlCache.set(source, job);
  return job;
}

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function processInBatches<T>(label: string, rows: T[], worker: (row: T) => Promise<void>) {
  let completed = 0;
  const failures: unknown[] = [];
  for (let offset = 0; offset < rows.length; offset += CONCURRENCY) {
    const batch = rows.slice(offset, offset + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(worker));
    settled.forEach((result) => {
      if (result.status === "rejected") {
        failures.push(result.reason);
        console.error(`[fail] ${label}:`, result.reason);
      } else {
        completed += 1;
      }
    });
    console.log(`[${label}] ${Math.min(offset + batch.length, rows.length)}/${rows.length} scanned, ${completed} updated`);
  }
  if (failures.length) throw new Error(`${label}: ${failures.length} rows failed`);
}

async function migrateProducts() {
  const all = await fetchAll<ProductRow>("products", "id,images");
  const targets = all.filter((row) => (row.images || []).some(isLegacyStorageUrl));
  console.log(`[products] ${targets.length} rows need migration out of ${all.length}`);

  await processInBatches("products", targets, async (row) => {
    const images = [...(row.images || [])];
    let changed = false;
    for (let i = 0; i < images.length; i += 1) {
      if (!isLegacyStorageUrl(images[i])) continue;
      images[i] = await migrateUrl(images[i], "products", row.id, i);
      changed = true;
    }
    if (!changed) return;
    const { error } = await supabase.from("products").update({ images }).eq("id", row.id);
    if (error) throw new Error(error.message);
  });
}

async function migrateImageTable(table: "categories" | "banners") {
  const all = await fetchAll<ImageRow>(table, "id,image_url");
  const targets = all.filter((row) => isLegacyStorageUrl(row.image_url));
  console.log(`[${table}] ${targets.length} rows need migration out of ${all.length}`);

  await processInBatches(table, targets, async (row) => {
    if (!row.image_url) return;
    const image_url = await migrateUrl(row.image_url, table, row.id);
    const { error } = await supabase.from(table).update({ image_url }).eq("id", row.id);
    if (error) throw new Error(error.message);
  });
}

async function verify() {
  const [products, categories, banners] = await Promise.all([
    fetchAll<ProductRow>("products", "id,images"),
    fetchAll<ImageRow>("categories", "id,image_url"),
    fetchAll<ImageRow>("banners", "id,image_url"),
  ]);
  const productUrls = products.flatMap((row) => row.images || []).filter(isLegacyStorageUrl);
  const categoryUrls = categories.map((row) => row.image_url).filter(isLegacyStorageUrl);
  const bannerUrls = banners.map((row) => row.image_url).filter(isLegacyStorageUrl);
  const remaining = productUrls.length + categoryUrls.length + bannerUrls.length;

  console.log(JSON.stringify({
    remaining_supabase_storage_urls: remaining,
    products: productUrls.length,
    categories: categoryUrls.length,
    banners: bannerUrls.length,
  }, null, 2));

  if (remaining !== 0) {
    throw new Error(`Verification failed: ${remaining} Supabase Storage URLs remain`);
  }
}

async function main() {
  console.log("Starting Supabase Storage -> Cloudflare R2 migration");
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`R2 public URL: ${process.env.R2_PUBLIC_URL}`);
  console.log("Orders table is not read or modified by this script.");

  await migrateProducts();
  await migrateImageTable("categories");
  await migrateImageTable("banners");
  await verify();

  console.log("Migration complete. Safe to run scripts/lock-supabase-storage.ts after visual verification.");
}

main().catch((error) => {
  console.error("[migration fatal]", error);
  process.exitCode = 1;
});
