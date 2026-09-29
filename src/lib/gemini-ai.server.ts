import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { getDeliveryInfo, normalizeDeliveryRules, type DeliveryRule } from "@/lib/delivery-rules";
import { LIVE_SUPABASE_PUBLISHABLE_KEY, LIVE_SUPABASE_URL } from "@/integrations/supabase/public-env";
import { getRequestIP } from "@tanstack/react-start/server";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
type Msg = { role: "user" | "model"; parts: any[] };
type Item = { product_name: string; quantity: number };
type MediaInput = { mediaType: string; data: string; name?: string };
type ProductResult = { id: string; name: string; price: number; sale_price: number | null; stock: number; slug: string; short_description: string | null; images: string[] | null };

const CONFIG_TTL_MS = 5 * 60_000;
let configCache: { apiKey: string; model: string; expiresAt: number } | null = null;
let shopCache: {
  value: { name: string; phone: string; address: string; tagline: string; rules: DeliveryRule[] };
  expiresAt: number;
} | null = null;

async function getConfig() {
  if (configCache && configCache.expiresAt > Date.now()) return configCache;
  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let apiKey = process.env.GEMINI_API_KEY || "";
  try {
    const { data } = await supabaseAdmin.from("site_ai_settings").select("model,api_key").limit(1).maybeSingle();
    if (data?.model) model = String(data.model);
    if (data?.api_key) apiKey = String(data.api_key);
  } catch {
    // Fall back to server env / Supabase Edge Function when settings are unavailable.
  }
  if (/^gemini-(1\.5|2\.0)/.test(model)) model = DEFAULT_MODEL;
  configCache = { apiKey, model, expiresAt: Date.now() + CONFIG_TTL_MS };
  return configCache;
}

function aiEndpoint() {
  // Website AI is configured in the canonical production Supabase project.
  // Do not use host-level SUPABASE_URL overrides here: stale Cloudflare env
  // values can point this chat at a paused/old project and surface 530 errors.
  return `${LIVE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/website-ai-chat`;
}

async function callGemini(body: Record<string, unknown>, config: { apiKey: string; model: string }) {
  const requestedModel = String(body.model || config.model || DEFAULT_MODEL);

  // Fast path: the Cloudflare server already runs in a trusted environment, so
  // call Gemini directly with the server-only key and skip an extra Edge Function hop.
  if (config.apiKey) {
    const { model: _model, ...payload } = body;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(requestedModel)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json: any = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.error?.message || json?.error || `Gemini API ${response.status}`);
    return json;
  }

  // Fallback keeps existing deployments working if the key is intentionally held
  // only by the Supabase Edge Function.
  const key = LIVE_SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(aiEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify(body),
  });
  const json: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error || `AI service ${response.status}`);
  return json;
}

async function shopContext() {
  if (shopCache && shopCache.expiresAt > Date.now()) return shopCache.value;
  const { data } = await supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle();
  const s = (data?.settings as Record<string, unknown> | null) ?? {};
  const value = {
    name: String(s.site_name || "Sheikh Seeds"),
    phone: String(s.contact_phone || s.phone || "+8809644553383"),
    address: String(s.address || ""),
    tagline: String(s.tagline || "দেশী ও বিদেশী বীজের বিশ্বস্ত প্রতিষ্ঠান"),
    rules: normalizeDeliveryRules(s.delivery_rules) as DeliveryRule[],
  };
  shopCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
  return value;
}

async function searchProducts(query: string) {
  const q = query.trim();
  const { data } = await supabaseAdmin.from("products").select("id,name,price,sale_price,stock,slug,short_description,images").eq("is_active", true).ilike("name", `%${q}%`).limit(10);
  if (data?.length) return data;
  const { data: fallback } = await supabaseAdmin.from("products").select("id,name,price,sale_price,stock,slug,short_description,images").eq("is_active", true).order("is_featured", { ascending: false }).limit(10);
  return fallback ?? [];
}

async function createOrder(args: { customer_name: string; customer_phone: string; customer_address: string; inside_dhaka: boolean; items: Item[] }) {
  if (!args.customer_name?.trim()) return { ok: false, error: "কাস্টমারের নাম প্রয়োজন" };
  if (!args.customer_address?.trim()) return { ok: false, error: "পূর্ণ ঠিকানা প্রয়োজন" };
  const phone = String(args.customer_phone || "").replace(/\D/g, "").slice(-11);
  if (phone.length !== 11) return { ok: false, error: "সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রয়োজন" };
  if (!Array.isArray(args.items) || !args.items.length) return { ok: false, error: "অন্তত একটি প্রোডাক্ট প্রয়োজন" };

  const shop = await shopContext();
  const rows: Array<{ product_id: string; product_name: string; price: number; quantity: number; subtotal: number }> = [];
  for (const item of args.items.slice(0, 20)) {
    const matches = await searchProducts(item.product_name);
    const match = matches.find((p) => p.name.toLowerCase().includes(item.product_name.toLowerCase())) ?? matches[0];
    if (!match) return { ok: false, error: `${item.product_name} পাওয়া যায়নি` };
    const price = Number(match.sale_price ?? match.price);
    const stock = Number(match.stock ?? 0);
    const quantity = Math.max(1, Math.min(100, Math.round(Number(item.quantity) || 1)));
    if (stock <= 0) return { ok: false, error: `${match.name} বর্তমানে স্টকে নেই` };
    if (quantity > stock) return { ok: false, error: `${match.name}-এর পর্যাপ্ত স্টক নেই` };
    rows.push({ product_id: match.id, product_name: match.name, price, quantity, subtotal: price * quantity });
  }
  const subtotal = rows.reduce((a, r) => a + r.subtotal, 0);
  const delivery = getDeliveryInfo(subtotal, shop.rules).delivery;
  const clientIp = getRequestIP({ xForwardedFor: true }) ?? null;
  const { data: blocked, error: blockError } = await supabaseAdmin.rpc("is_blocked_visitor", { p_ip: clientIp ?? undefined, p_phone: phone });
  if (!blockError && blocked === true) return { ok: false, error: "এই ফোন নম্বর থেকে অর্ডার গ্রহণ করা যাচ্ছে না" };
  if (phone.length >= 6) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin.from("orders").select("id,invoice_no,total").eq("source", "web").ilike("customer_phone", `%${phone}%`).is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent && Math.abs(Number(recent.total) - subtotal - delivery) < 0.01) return { ok: true, duplicate: true, invoice_no: recent.invoice_no, total: Number(recent.total), order_id: recent.id };
  }
  const { data: orderId, error } = await supabaseAdmin.rpc("place_public_order", {
    p_customer_name: args.customer_name.trim().slice(0, 255), p_customer_phone: phone,
    p_customer_address: args.customer_address.trim().slice(0, 1000), p_delivery_fee: delivery,
    p_items: rows.map((r) => ({ id: r.product_id, name: r.product_name, price: r.price, quantity: r.quantity })),
    p_notes: "Website Gemini AI অর্ডার", p_client_ip: clientIp ?? undefined,
  });
  if (error || !orderId) return { ok: false, error: error?.message || "অর্ডার তৈরি হয়নি" };
  const { data: order } = await supabaseAdmin.from("orders").select("id,invoice_no,total").eq("id", orderId).single();
  return { ok: true, order_id: String(orderId), invoice_no: order?.invoice_no ?? null, total: Number(order?.total ?? subtotal + delivery), delivery_fee: delivery };
}

export async function generateGeminiWebReply(input: { incoming: string; history: { direction: string; text: string | null }[]; attachments?: MediaInput[] }) {
  const [config, shop] = await Promise.all([getConfig(), shopContext()]);
  const { model } = config;
  const history = input.history.slice(-6).filter((m) => m.text);
  let messages: Msg[] = history.map((m) => ({ role: m.direction === "in" ? "user" : "model", parts: [{ text: m.text ?? "" }] }));
  const userParts: any[] = [];
  if (input.incoming) userParts.push({ text: input.incoming });
  for (const attachment of input.attachments ?? []) userParts.push({ inlineData: { mimeType: attachment.mediaType, data: attachment.data } });
  messages.push({ role: "user", parts: userParts });
  const combined = [...history.map((m) => m.text || ""), input.incoming].join(" ").toLowerCase();
  const hasOrderIntent = /(অর্ডার|নিব|নিতে চাই|কিনব|কিনতে চাই|order|buy)/i.test(combined);
  const explicitConfirmation = /(জি|হ্যাঁ|হ্যা|yes|confirm|কনফার্ম|অর্ডার দিন|অর্ডার করুন|নিশ্চিত)/i.test(input.incoming);
  const allowCreateOrder = hasOrderIntent && explicitConfirmation;
  const system = `আপনি ${shop.name}-এর ওয়েবসাইট কাস্টমার কেয়ার ও কৃষি সহকারী। উত্তর হবে সরাসরি, সহজ বাংলা, সাধারণত ১-৩টি ছোট বাক্য। অপ্রয়োজনীয় ভূমিকা/পুনরাবৃত্তি নয়। ছবি দেখে রোগ নিশ্চিত দাবি করবেন না; সম্ভাবনা ও নিরাপদ করণীয় বলবেন। ব্যবসা: ${shop.tagline}; ফোন: ${shop.phone}; ঠিকানা: ${shop.address || "ফোনে যোগাযোগ করতে বলুন"}। দাম/স্টক অনুমান নয়—প্রয়োজনে search_products ব্যবহার করুন। Delivery rules: ${JSON.stringify(shop.rules)}। COD আছে। অর্ডারে নাম, ১১ ডিজিট মোবাইল, পূর্ণ ঠিকানা, পণ্য ও quantity নিন; মোট জানিয়ে স্পষ্ট সম্মতির পরই create_order। ${allowCreateOrder ? "এই বার্তায় সম্মতি আছে, তবে তথ্য সম্পূর্ণ হতে হবে।" : "এই বার্তায় create_order ব্যবহার করবেন না।"}`;
  const needsCatalogTool = /(দাম|price|স্টক|stock|পণ্য|product|বীজ|seed|সার|কীটনাশক|টুল|অর্ডার|order|buy|কিন|কম্বো|combo)/i.test(combined);
  const declarations: any[] = needsCatalogTool ? [{ name: "search_products", description: "শপের active products খুঁজে দাম, stock ও তথ্য যাচাই করুন", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }] : [];
  if (allowCreateOrder) declarations.push({ name: "create_order", description: "প্রয়োজনীয় customer তথ্য ও product নিশ্চিত হওয়ার পর অর্ডার তৈরি করুন", parameters: { type: "OBJECT", properties: { customer_name: { type: "STRING" }, customer_phone: { type: "STRING" }, customer_address: { type: "STRING" }, inside_dhaka: { type: "BOOLEAN" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { product_name: { type: "STRING" }, quantity: { type: "NUMBER" } }, required: ["product_name", "quantity"] } } }, required: ["customer_name", "customer_phone", "customer_address", "inside_dhaka", "items"] } });
  const shownProducts = new Map<string, ProductResult>();
  let createdOrder: { order_id?: string; invoice_no?: string | null; total?: number } | null = null;
  for (let round = 0; round < 4; round++) {
    const json = await callGemini({
      model,
      systemInstruction: { parts: [{ text: system }] },
      contents: messages,
      ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
      generationConfig: { maxOutputTokens: 320 },
    }, config);
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p: any) => p.functionCall);
    if (!calls.length) return { text: String(parts.find((p: any) => p.text)?.text || "").trim(), products: [...shownProducts.values()].slice(0, 6), orderId: (createdOrder as any)?.order_id ?? null, invoiceNo: (createdOrder as any)?.invoice_no ?? null, needsHuman: false };
    messages.push({ role: "model", parts });
    for (const p of calls) {
      const name = p.functionCall.name;
      const args = p.functionCall.args ?? {};
      const raw = name === "search_products" ? await searchProducts(String(args.query || "")) : name === "create_order" && allowCreateOrder ? await createOrder(args) : { error: "এই মুহূর্তে এই কাজটি অনুমোদিত নয়" };
      if (name === "search_products" && Array.isArray(raw)) for (const product of raw as ProductResult[]) shownProducts.set(product.id, product);
      if (name === "create_order" && !Array.isArray(raw) && (raw as { ok?: boolean }).ok) createdOrder = raw as unknown as typeof createdOrder;
      // Gemini requires functionResponse.response to be an object, never a bare array.
      const result = Array.isArray(raw) ? { products: raw } : raw;
      const fr: any = { name, response: result };
      if (p.functionCall.id) fr.id = p.functionCall.id;
      messages.push({ role: "user", parts: [{ functionResponse: fr }] });
    }
  }
  throw new Error("AI response loop exceeded");
}
