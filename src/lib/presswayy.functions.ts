import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const STORE_URL = "https://oronnonogor.com";
const WEBHOOK_URL = "https://app.presswayy.com/api/store/webhooks";
const ROW = "presswayy_store";

type PressCfg = { connection_key: string; store_url: string; inbound_base: string; platform: string; framework: string };
type StoredRow = { config: Partial<PressCfg>; is_active: boolean } | null;
const ConfigSchema = z.object({ connection_key: z.string().trim().min(20).max(300), store_url: z.string().url().default(STORE_URL), inbound_base: z.string().default("/presswayy/v1"), platform: z.string().default("tanstack"), framework: z.string().default("custom") });

async function loadConfig(): Promise<StoredRow> { const { data } = await supabaseAdmin.from("integrations").select("config,is_active").eq("name", ROW).maybeSingle(); if (!data) return null; return { config: (data.config as Partial<PressCfg>) ?? {}, is_active: !!data.is_active }; }
function splitKey(key: string) { const dot = key.indexOf("."); if (dot <= 0 || dot === key.length - 1) throw new Error("Invalid Presswayy connection key"); return { id: key.slice(0, dot), secret: key.slice(dot + 1) }; }
function sign(body: string, secret: string) { return createHmac("sha256", secret).update(body).digest("base64"); }
async function presswayyRequest(key: string, topic: string, payload: unknown) { const { id, secret } = splitKey(key); const body = JSON.stringify(payload); const res = await fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Presswayy-Key": id, "X-Presswayy-Signature": sign(body, secret), "X-Presswayy-Topic": topic }, body }); const text = await res.text(); if (!res.ok) throw new Error(`Presswayy ${topic} failed (${res.status}): ${text.slice(0, 240)}`); return text; }

export const getPresswayyStatus = createServerFn({ method: "GET" }).handler(async () => { const row = await loadConfig(); return { connected: !!row?.config.connection_key, active: !!row?.is_active, store_url: row?.config.store_url ?? STORE_URL, inbound_url: `${STORE_URL}/presswayy/v1`, key_id: row?.config.connection_key?.split(".")[0] ?? "" }; });
export const savePresswayy = createServerFn({ method: "POST" }).inputValidator((input) => ConfigSchema.parse(input)).handler(async ({ data }) => { const cfg = { ...data, store_url: STORE_URL, inbound_base: "/presswayy/v1" }; const { error } = await supabaseAdmin.from("integrations").upsert({ name: ROW, is_active: true, config: cfg, updated_at: new Date().toISOString() }, { onConflict: "name" }); if (error) throw new Error(error.message); return { ok: true, key_id: splitKey(cfg.connection_key).id }; });
export const registerPresswayy = createServerFn({ method: "POST" }).handler(async () => { const row = await loadConfig(); if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured"); await presswayyRequest(row.config.connection_key, "register", { store_url: STORE_URL, platform: row.config.platform ?? "tanstack", framework: row.config.framework ?? "custom", inbound_base: "/presswayy/v1", currency: "BDT" }); return { ok: true }; });
export const testPresswayy = createServerFn({ method: "POST" }).handler(async () => { const row = await loadConfig(); if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured"); const result = await presswayyRequest(row.config.connection_key, "ping", { store_url: STORE_URL }); return { ok: true, response: result.slice(0, 300) }; });
export const resyncPresswayy = createServerFn({ method: "POST" }).handler(async () => { const row = await loadConfig(); if (!row?.config.connection_key) throw new Error("Presswayy connection key is not configured"); const { data: products, error: productError } = await supabaseAdmin.from("products").select("id,name,sku,price,sale_price,stock,is_active,images,category_id,categories(name)").order("created_at", { ascending: true }); if (productError) throw new Error(productError.message); let pushed = 0; for (const p of products ?? []) { await presswayyRequest(row.config.connection_key, "product.upsert", { product: { id: p.id, name: p.name, sku: p.sku ?? undefined, regular_price: String(p.price ?? 0), sale_price: p.sale_price != null ? String(p.sale_price) : null, stock_quantity: Number(p.stock ?? 0), status: p.is_active === false ? "draft" : "publish", image_url: Array.isArray(p.images) ? p.images[0] ?? null : null, gallery_images: Array.isArray(p.images) ? p.images : [], categories: [(p.categories as { name?: string } | null)?.name].filter(Boolean) } }); pushed++; } return { ok: true, products: pushed }; });

export const presswayyInboundVerify = async (request: Request) => { const row = await loadConfig(); if (!row?.is_active || !row.config.connection_key) return { ok: false as const, status: 503, row: null, raw: "" }; const { secret, id } = splitKey(row.config.connection_key); const raw = await request.text(); const supplied = request.headers.get("x-presswayy-signature") ?? ""; const expected = sign(raw, secret); const a = Buffer.from(supplied), b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false as const, status: 401, row, raw }; if (request.headers.get("x-presswayy-key") !== id) return { ok: false as const, status: 401, row, raw }; return { ok: true as const, status: 200, row, raw }; };

export async function handlePresswayyOrder(input: any) {
  const payload = input?.order && !input?.line_items ? input.order : input;
  const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
  const customer = payload.customer ?? payload.billing ?? {};
  const externalId = payload.id ?? payload.order_id ?? payload.number ?? payload.order_number ?? null;

  if (externalId != null) {
    const marker = `[presswayy_id:${String(externalId)}]`;
    const { data: existing } = await supabaseAdmin.from("orders").select("id").eq("source", "presswayy-ai").ilike("notes", `%${marker}%`).limit(1).maybeSingle();
    if (existing) return { order_id: existing.id, order_number: String(existing.id), duplicate: true };
  }

  const ids = items.map((i: any) => String(i.product_id ?? "")).filter(Boolean);
  const { data: products, error: productLookupError } = ids.length ? await supabaseAdmin.from("products").select("id,name,price,sale_price").in("id", ids) : { data: [], error: null };
  if (productLookupError) throw new Error(productLookupError.message);
  const map = new Map((products ?? []).map((p: any) => [String(p.id), p]));

  const rows = items.map((i: any) => {
    const p = map.get(String(i.product_id));
    const quantity = Math.max(1, Number(i.quantity ?? 1));
    const itemTotal = Number(i.total ?? 0);
    const price = itemTotal > 0 ? itemTotal / quantity : Number(p?.sale_price ?? p?.price ?? i.price ?? 0);
    return { product_id: p?.id ?? null, product_name: p?.name ?? i.name ?? i.product_name ?? "Presswayy AI Product", price, quantity, subtotal: itemTotal > 0 ? itemTotal : price * quantity, _matched: !!p };
  });

  const subtotal = Number(payload.subtotal ?? rows.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0));
  const total = Number(payload.total ?? subtotal);
  const address = typeof customer.address_1 === "string" ? customer.address_1 : (typeof customer.address === "string" ? customer.address : (customer.address_1 ? JSON.stringify(customer.address_1) : ""));
  const notes = [payload.note, externalId != null ? `[presswayy_id:${String(externalId)}]` : null, !items.length ? "[presswayy_no_line_items]" : null].filter(Boolean).join(" | ");

  // Create the order first. A missing/mismatched local product must never cause
  // the Presswayy order itself to disappear from SMS Orders.
  const { data: order, error } = await supabaseAdmin.from("orders").insert({ customer_name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.name || "Presswayy AI Customer", customer_phone: customer.phone ?? "", customer_address: address, notes, subtotal, delivery_fee: Number(payload.delivery_fee ?? 0), total, payment_method: "COD", source: "presswayy-ai", status: payload.status ?? "processing" }).select("id").single();
  if (error || !order) throw new Error(error?.message ?? "Order create failed");

  // Only insert line items whose product exists locally. This keeps the order
  // visible even when Presswayy and the local catalog IDs differ.
  const matchedRows = rows.filter((r: any) => r._matched).map(({ _matched, ...r }: any) => ({ ...r, order_id: order.id }));
  if (matchedRows.length) {
    const { error: itemError } = await supabaseAdmin.from("order_items").insert(matchedRows);
    if (itemError) {
      console.error("[presswayy/order] item insert failed; keeping order", itemError);
    }
  }

  return { order_id: order.id, order_number: String(order.id), synced_items: matchedRows.length, received_items: rows.length };
}

export async function handlePresswayyInventory(payload: any) { if (!payload?.product_id) throw new Error("product_id is required"); const { error } = await supabaseAdmin.from("products").update({ stock: Math.max(0, Number(payload.stock_quantity ?? 0)) }).eq("id", payload.product_id); if (error) throw new Error(error.message); return { ok: true }; }
