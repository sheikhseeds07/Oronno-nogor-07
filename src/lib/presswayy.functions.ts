import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { assertPermission } from "@/lib/_admin-guard.server";

const STORE_URL = "https://oronnonogor.com";
const WEBHOOK_URL = "https://app.presswayy.com/api/store/webhooks";
const ROW = "presswayy_store";

type PressCfg = { connection_key: string; store_url: string; inbound_base: string; platform: string; framework: string };
type StoredRow = { config: Partial<PressCfg>; is_active: boolean } | null;
const ConfigSchema = z.object({ connection_key: z.string().trim().min(20).max(300), store_url: z.string().url().default(STORE_URL), inbound_base: z.string().default("/presswayy/v1"), platform: z.string().default("tanstack"), framework: z.string().default("custom") });

async function loadConfig(): Promise<StoredRow> {
  const { data } = await supabaseAdmin.from("integrations").select("config,is_active").eq("name", ROW).maybeSingle();
  if (!data) return null;
  return { config: (data.config as Partial<PressCfg>) ?? {}, is_active: !!data.is_active };
}

function splitKey(key: string) {
  const dot = key.indexOf(".");
  if (dot <= 0 || dot === key.length - 1) throw new Error("Invalid Presswayy connection key");
  return { id: key.slice(0, dot), secret: key.slice(dot + 1) };
}

function sign(body: string, secret: string) {
  return createHmac("sha256", secret).update(body).digest("base64");
}

async function presswayyRequest(key: string, topic: string, payload: unknown) {
  const { id, secret } = splitKey(key);
  const body = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Presswayy-Key": id,
      "X-Presswayy-Signature": sign(body, secret),
      "X-Presswayy-Topic": topic,
    },
    body,
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Some successful webhook responses may be plain text.
  }

  // Do not treat a 2xx response as success when Presswayy explicitly reports failure.
  if (!res.ok || parsed?.ok === false || parsed?.success === false || parsed?.error) {
    const detail = parsed?.error?.message ?? parsed?.error ?? parsed?.message ?? text;
    throw new Error(`Presswayy ${topic} failed (${res.status}): ${String(detail).slice(0, 500)}`);
  }

  return { status: res.status, text, data: parsed };
}

export const getPresswayyStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertPermission(context.userId, "integrations", "courier");
  const row = await loadConfig();
  return { connected: !!row?.config.connection_key, active: !!row?.is_active, store_url: row?.config.store_url ?? STORE_URL, inbound_url: `${STORE_URL}/presswayy/v1`, key_id: row?.config.connection_key?.split(".")[0] ?? "" };
});

export const savePresswayy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => ConfigSchema.parse(input)).handler(async ({ data, context }) => {
  await assertPermission(context.userId, "integrations", "courier");
  const cfg = { ...data, store_url: STORE_URL, inbound_base: "/presswayy/v1" };
  const { error } = await supabaseAdmin.from("integrations").upsert({ name: ROW, is_active: true, config: cfg, updated_at: new Date().toISOString() }, { onConflict: "name" });
  if (error) throw new Error(error.message);
  return { ok: true, key_id: splitKey(cfg.connection_key).id };
});

export const registerPresswayy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertPermission(context.userId, "integrations", "courier");
  const row = await loadConfig();
  if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured");
  await presswayyRequest(row.config.connection_key, "register", { store_url: STORE_URL, platform: row.config.platform ?? "tanstack", framework: row.config.framework ?? "custom", inbound_base: "/presswayy/v1", currency: "BDT" });
  return { ok: true };
});

export const testPresswayy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertPermission(context.userId, "integrations", "courier");
  const row = await loadConfig();
  if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured");
  const result = await presswayyRequest(row.config.connection_key, "ping", { store_url: STORE_URL });
  return { ok: true, response: result.text.slice(0, 300) };
});

export async function runPresswayyResync() {
  const row = await loadConfig();
  if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured");

  const { data: products, error: productError } = await supabaseAdmin
    .from("products")
    .select("id,name,sku,price,sale_price,stock,is_active,images,category_id,categories(name)")
    .order("created_at", { ascending: true });
  if (productError) throw new Error(productError.message);

  let pushed = 0;
  const failed: Array<{ id: string; name: string; error: string }> = [];

  for (const p of products ?? []) {
    try {
      const images = Array.isArray(p.images) ? p.images.filter((image): image is string => typeof image === "string" && image.length > 0) : [];
      const category = (p.categories as { name?: string } | null)?.name;

      await presswayyRequest(row.config.connection_key, "product.upsert", {
        product: {
          id: p.id,
          name: p.name,
          sku: p.sku ?? undefined,
          regular_price: String(p.price ?? 0),
          sale_price: p.sale_price != null ? String(p.sale_price) : null,
          stock_quantity: Number(p.stock ?? 0),
          status: p.is_active === false ? "draft" : "publish",
          image_url: images[0] ?? null,
          gallery_images: images,
          categories: category ? [category] : [],
        },
      });
      pushed++;
    } catch (error) {
      failed.push({
        id: String(p.id),
        name: String(p.name ?? "Unnamed product"),
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
  }

  if (failed.length > 0) {
    const preview = failed.slice(0, 3).map((item) => `${item.name}: ${item.error}`).join(" | ");
    throw new Error(`Product sync partial failure: ${pushed}টি সফল, ${failed.length}টি ব্যর্থ। ${preview}`);
  }

  return { ok: true, products: pushed, failed: [] };
}

export const resyncPresswayy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPermission(context.userId, "integrations", "courier");
    return runPresswayyResync();
  });

export const presswayyInboundVerify = async (request: Request) => {
  const row = await loadConfig();
  if (!row?.is_active || !row.config.connection_key) return { ok: false as const, status: 503, row: null, raw: "" };
  const { secret, id } = splitKey(row.config.connection_key);
  const raw = await request.text();
  const supplied = request.headers.get("x-presswayy-signature") ?? "";
  const expected = sign(raw, secret);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false as const, status: 401, row, raw };
  if (request.headers.get("x-presswayy-key") !== id) return { ok: false as const, status: 401, row, raw };
  return { ok: true as const, status: 200, row, raw };
};

export async function handlePresswayyInventory(payload: any) {
  if (!payload?.product_id) throw new Error("product_id is required");
  const { error } = await supabaseAdmin.from("products").update({ stock: Math.max(0, Number(payload.stock_quantity ?? 0)) }).eq("id", payload.product_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
