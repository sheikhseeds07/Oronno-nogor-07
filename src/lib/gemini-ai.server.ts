import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { normalizeDeliveryRules, type DeliveryRule } from "@/lib/delivery-rules";
import { LIVE_SUPABASE_PUBLISHABLE_KEY, LIVE_SUPABASE_URL } from "@/integrations/supabase/public-env";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
type Msg = { role: "user" | "model"; parts: any[] };
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
  const system = `আপনি ${shop.name}-এর ওয়েবসাইটের তথ্য সহকারী ও কৃষি সহকারী। উত্তর হবে সরাসরি, সহজ বাংলা, সাধারণত ১-৩টি ছোট বাক্য। অপ্রয়োজনীয় ভূমিকা/পুনরাবৃত্তি নয়। ছবি দেখে রোগ নিশ্চিত দাবি করবেন না; সম্ভাবনা ও নিরাপদ করণীয় বলবেন। ব্যবসা: ${shop.tagline}; ফোন: ${shop.phone}; ঠিকানা: ${shop.address || "ফোনে যোগাযোগ করতে বলুন"}। দাম/স্টক অনুমান নয়—প্রয়োজনে search_products ব্যবহার করুন। Delivery rules: ${JSON.stringify(shop.rules)}। COD ও ডেলিভারি সম্পর্কিত তথ্য জানাতে পারবেন।

কঠোর নিয়ম: এই chat-এর ভেতরে কোনো অর্ডার নেবেন না এবং অর্ডার তৈরি/কনফার্ম করবেন না। কাস্টমারের নাম, ফোন নম্বর বা পূর্ণ ঠিকানা নিয়ে checkout করবেন না। কাস্টমার অর্ডার করতে চাইলে সংশ্লিষ্ট পণ্যের product card দেখান এবং বলুন card-এ ক্লিক করে সাইট থেকেই অর্ডার করতে পারবেন। কাস্টমার কোনো নির্দিষ্ট পণ্য/বীজ/সার/কীটনাশক/টুল সম্পর্কে জানতে চাইলে আগে search_products দিয়ে পণ্য খুঁজে product card দেখান, তারপর সংক্ষেপে প্রয়োজনীয় তথ্য দিন। কোনো অর্ডার সম্পন্ন হয়েছে এমন দাবি করবেন না।`;
  // Only product search is exposed. Checkout stays on the normal website product page.
  const declarations: any[] = [{
    name: "search_products",
    description: "শপের active products খুঁজে product card-এর জন্য নাম, দাম, stock, slug, image ও সংক্ষিপ্ত তথ্য ফেরত দিন",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING" } },
      required: ["query"]
    }
  }];
  const shownProducts = new Map<string, ProductResult>();
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
    if (!calls.length) return { text: String(parts.find((p: any) => p.text)?.text || "").trim(), products: [...shownProducts.values()].slice(0, 6), orderId: null, invoiceNo: null, needsHuman: false };
    messages.push({ role: "model", parts });
    for (const p of calls) {
      const name = p.functionCall.name;
      const args = p.functionCall.args ?? {};
      const raw = name === "search_products" ? await searchProducts(String(args.query || "")) : { error: "এই মুহূর্তে এই কাজটি অনুমোদিত নয়" };
      if (name === "search_products" && Array.isArray(raw)) for (const product of raw as ProductResult[]) shownProducts.set(product.id, product);
      // Gemini requires functionResponse.response to be an object, never a bare array.
      const result = Array.isArray(raw) ? { products: raw } : raw;
      const fr: any = { name, response: result };
      if (p.functionCall.id) fr.id = p.functionCall.id;
      messages.push({ role: "user", parts: [{ functionResponse: fr }] });
    }
  }
  throw new Error("AI response loop exceeded");
}
