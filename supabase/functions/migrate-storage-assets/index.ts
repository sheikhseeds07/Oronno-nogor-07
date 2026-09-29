import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const OLD_HOST = "bvuhvzccziuniujeogng.supabase.co";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const C = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

type Parsed = { source: string; bucket: string; path: string };
type CopyResult = { url: string | null; copied: boolean; key?: string; error?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: C });
}

function parseOldMedia(value: string): Parsed | null {
  if (!value) return null;
  try {
    const wrapper = new URL(value, "https://sheikhseeds.com");
    const raw = wrapper.pathname === "/media" ? wrapper.searchParams.get("src") : value;
    if (!raw) return null;
    const source = new URL(raw);
    if (source.hostname !== OLD_HOST) return null;
    const m = source.pathname.match(/^\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return {
      source: source.toString(),
      bucket: decodeURIComponent(m[1]),
      path: decodeURIComponent(m[2]),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const supplied = req.headers.get("x-storage-migration-secret") ?? "";
  const { data: secretRow, error: secretError } = await admin
    .from("system_job_secrets")
    .select("secret")
    .eq("name", "storage_migration")
    .maybeSingle();

  if (secretError || !secretRow?.secret || supplied !== secretRow.secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const copied = new Map<string, string>();
  const failures: Array<{ key: string; status?: number; error: string }> = [];
  let copiedFiles = 0;
  let reusedFiles = 0;
  let updatedProducts = 0;
  let updatedCategories = 0;

  async function copyOne(value: string): Promise<CopyResult> {
    const parsed = parseOldMedia(value);
    if (!parsed) return { url: value, copied: false };

    const key = `${parsed.bucket}/${parsed.path}`;
    const prior = copied.get(key);
    if (prior) {
      reusedFiles++;
      return { url: prior, copied: false, key };
    }

    try {
      const response = await fetch(parsed.source, {
        method: "GET",
        headers: { accept: "*/*", "cache-control": "no-cache" },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        failures.push({ key, status: response.status, error: `source HTTP ${response.status}` });
        return { url: value, copied: false, key, error: `source HTTP ${response.status}` };
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "application/octet-stream";

      const { error: uploadError } = await admin.storage
        .from(parsed.bucket)
        .upload(parsed.path, bytes, {
          upsert: true,
          contentType,
          cacheControl: "31536000",
        });

      if (uploadError) {
        failures.push({ key, error: uploadError.message });
        return { url: value, copied: false, key, error: uploadError.message };
      }

      const { data: signed, error: signError } = await admin.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, TEN_YEARS);

      if (signError || !signed?.signedUrl) {
        const message = signError?.message || "new signed URL missing";
        failures.push({ key, error: message });
        return { url: value, copied: false, key, error: message };
      }

      const next = `/media?src=${encodeURIComponent(signed.signedUrl)}`;
      copied.set(key, next);
      copiedFiles++;
      return { url: next, copied: true, key };
    } catch (error) {
      const message = error instanceof Error ? error.message : "copy failed";
      failures.push({ key, error: message });
      return { url: value, copied: false, key, error: message };
    }
  }

  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id,images");

  if (productsError) return json({ error: productsError.message }, 500);

  for (const product of products ?? []) {
    const images = Array.isArray(product.images) ? product.images.map(String) : [];
    let changed = false;
    const nextImages: string[] = [];
    for (const value of images) {
      const result = await copyOne(value);
      nextImages.push(result.url ?? value);
      if ((result.url ?? value) !== value) changed = true;
    }
    if (changed) {
      const { error } = await admin.from("products").update({ images: nextImages }).eq("id", product.id);
      if (error) failures.push({ key: `product:${product.id}`, error: error.message });
      else updatedProducts++;
    }
  }

  const { data: categories, error: categoriesError } = await admin
    .from("categories")
    .select("id,image_url")
    .not("image_url", "is", null);

  if (categoriesError) return json({ error: categoriesError.message }, 500);

  for (const category of categories ?? []) {
    const value = String(category.image_url ?? "");
    const result = await copyOne(value);
    const next = result.url ?? value;
    if (next !== value) {
      const { error } = await admin.from("categories").update({ image_url: next }).eq("id", category.id);
      if (error) failures.push({ key: `category:${category.id}`, error: error.message });
      else updatedCategories++;
    }
  }


  let updatedOtherRows = 0;

  async function migrateScalarField(table: string, field: string) {
    const { data: rows, error } = await admin.from(table).select(`id,${field}`).not(field, "is", null);
    if (error) {
      failures.push({ key: `${table}.${field}`, error: error.message });
      return;
    }
    for (const row of rows ?? []) {
      const value = String((row as Record<string, unknown>)[field] ?? "");
      if (!value) continue;
      const result = await copyOne(value);
      const next = result.url ?? value;
      if (next !== value) {
        const { error: updateError } = await admin.from(table).update({ [field]: next }).eq("id", (row as Record<string, unknown>).id);
        if (updateError) failures.push({ key: `${table}:${String((row as Record<string, unknown>).id)}:${field}`, error: updateError.message });
        else updatedOtherRows++;
      }
    }
  }

  async function migrateArrayField(table: string, field: string) {
    const { data: rows, error } = await admin.from(table).select(`id,${field}`).not(field, "is", null);
    if (error) {
      failures.push({ key: `${table}.${field}`, error: error.message });
      return;
    }
    for (const row of rows ?? []) {
      const raw = (row as Record<string, unknown>)[field];
      const values = Array.isArray(raw) ? raw.map(String) : [];
      let changed = false;
      const nextValues: string[] = [];
      for (const value of values) {
        const result = await copyOne(value);
        const next = result.url ?? value;
        nextValues.push(next);
        if (next !== value) changed = true;
      }
      if (changed) {
        const { error: updateError } = await admin.from(table).update({ [field]: nextValues }).eq("id", (row as Record<string, unknown>).id);
        if (updateError) failures.push({ key: `${table}:${String((row as Record<string, unknown>).id)}:${field}`, error: updateError.message });
        else updatedOtherRows++;
      }
    }
  }

  await migrateScalarField("banners", "image_url");
  await migrateScalarField("landing_pages", "hero_image");
  await migrateArrayField("landing_pages", "gallery_images");
  await migrateScalarField("profiles", "avatar_url");
  await migrateScalarField("customer_profiles", "avatar_url");
  await migrateScalarField("customer_profiles", "cover_url");
  await migrateArrayField("product_reviews", "image_urls");
  await migrateScalarField("product_reviews", "author_avatar");
  await migrateScalarField("product_questions", "author_avatar");

  async function migrateJsonField(table: string, field: string) {
    async function walk(value: unknown): Promise<{ value: unknown; changed: boolean }> {
      if (typeof value === "string") {
        const result = await copyOne(value);
        const next = result.url ?? value;
        return { value: next, changed: next !== value };
      }
      if (Array.isArray(value)) {
        let changed = false;
        const next: unknown[] = [];
        for (const item of value) {
          const r = await walk(item);
          next.push(r.value);
          if (r.changed) changed = true;
        }
        return { value: next, changed };
      }
      if (value && typeof value === "object") {
        let changed = false;
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          const r = await walk(v);
          next[k] = r.value;
          if (r.changed) changed = true;
        }
        return { value: next, changed };
      }
      return { value, changed: false };
    }

    const { data: rows, error } = await admin.from(table).select(`id,${field}`).not(field, "is", null);
    if (error) {
      failures.push({ key: `${table}.${field}`, error: error.message });
      return;
    }
    for (const row of rows ?? []) {
      const original = (row as Record<string, unknown>)[field];
      const migrated = await walk(original);
      if (!migrated.changed) continue;
      const { error: updateError } = await admin.from(table)
        .update({ [field]: migrated.value })
        .eq("id", (row as Record<string, unknown>).id);
      if (updateError) failures.push({ key: `${table}:${String((row as Record<string, unknown>).id)}:${field}`, error: updateError.message });
      else updatedOtherRows++;
    }
  }

  for (const field of ["features","reviews","faq","addons","badges","seeds_list","planting_steps","why_choose_us"]) {
    await migrateJsonField("landing_pages", field);
  }
  await migrateJsonField("site_settings", "settings");
  await migrateJsonField("integrations", "config");

  return json({
    ok: failures.length === 0,
    copied_files: copiedFiles,
    reused_files: reusedFiles,
    updated_products: updatedProducts,
    updated_categories: updatedCategories,
    updated_other_rows: updatedOtherRows,
    failed: failures.length,
    failures: failures.slice(0, 20),
  }, failures.length ? 207 : 200);
});
