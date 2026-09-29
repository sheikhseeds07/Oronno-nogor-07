import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { getDeliveryInfo, normalizeDeliveryRules, type DeliveryRule } from "@/lib/delivery-rules";
import { LIVE_SUPABASE_PUBLISHABLE_KEY, LIVE_SUPABASE_URL } from "@/integrations/supabase/public-env";
import { getRequestIP } from "@tanstack/react-start/server";

const DEFAULT_MODEL = "gemini-flash-latest";
type Msg = { role: "user" | "model"; parts: any[] };
type Item = { product_name: string; quantity: number };
type MediaInput = { mediaType: string; data: string; name?: string };
type ProductResult = { id: string; name: string; price: number; sale_price: number | null; stock: number; slug: string; short_description: string | null; images: string[] | null };

async function getConfig() {
  // The API key is never read here: the edge function holds it. We only need the
  // preferred model, which is safe to read as the current (possibly anon) user.
  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    const { data } = await supabaseAdmin.from("site_ai_settings").select("model").limit(1).maybeSingle();
    if (data?.model) model = String(data.model);
  } catch {
    // Customers are anonymous and cannot read this table; the edge function resolves it.
  }
  if (/^gemini-(1\.5|2\.0|2\.5)/.test(model)) model = DEFAULT_MODEL;
  return { model };
}

function aiEndpoint() {
  // Website AI is configured in the canonical production Supabase project.
  // Do not use host-level SUPABASE_URL overrides here: stale Cloudflare env
  // values can point this chat at a paused/old project and surface 530 errors.
  return `${LIVE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/website-ai-chat`;
}

async function callGemini(body: Record<string, unknown>) {
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
  const { data } = await supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle();
  const s = (data?.settings as Record<string, unknown> | null) ?? {};
  const rules = normalizeDeliveryRules(s.delivery_rules) as DeliveryRule[];
  return {
    name: String(s.site_name || "Sheikh Seeds"),
    phone: String(s.contact_phone || s.phone || "+8809644553383"),
    address: String(s.address || ""),
    tagline: String(s.tagline || "দেশী ও বিদেশী বীজের বিশ্বস্ত প্রতিষ্ঠান"),
    rules,
  };
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
  const [{ model }, shop] = await Promise.all([getConfig(), shopContext()]);
  const history = input.history.slice(-8).filter((m) => m.text);
  let messages: Msg[] = history.map((m) => ({ role: m.direction === "in" ? "user" : "model", parts: [{ text: m.text ?? "" }] }));
  const userParts: any[] = [];
  if (input.incoming) userParts.push({ text: input.incoming });
  for (const attachment of input.attachments ?? []) userParts.push({ inlineData: { mimeType: attachment.mediaType, data: attachment.data } });
  messages.push({ role: "user", parts: userParts });
  const combined = [...history.map((m) => m.text || ""), input.incoming].join(" ").toLowerCase();
  const hasOrderIntent = /(অর্ডার|নিব|নিতে চাই|কিনব|কিনতে চাই|order|buy)/i.test(combined);
  const explicitConfirmation = /(জি|হ্যাঁ|হ্যা|yes|confirm|কনফার্ম|অর্ডার দিন|অর্ডার করুন|নিশ্চিত)/i.test(input.incoming);
  const allowCreateOrder = hasOrderIntent && explicitConfirmation;
  const system = `আপনি ${shop.name}-এর verified ওয়েবসাইট কাস্টমার কেয়ার, কৃষি পরামর্শক ও সেলস সহকারী। পরিচয়: ${shop.tagline}। ফোন: ${shop.phone}। ঠিকানা: ${shop.address || "ঠিকানা জানতে চাইলে ফোনে যোগাযোগ করতে বলুন"}। উত্তর দেওয়ার নিয়ম: (১) কাস্টমারের মূল প্রশ্নের উত্তর প্রথম বাক্যেই দিন; (২) সাধারণ প্রশ্নে ১-৩টি ছোট বাক্য, দরকার হলে সর্বোচ্চ ৩টি ছোট bullet; (৩) অপ্রয়োজনীয় ভূমিকা, একই তথ্য পুনরাবৃত্তি, অতিরিক্ত শুভেচ্ছা বা বিক্রয়মূলক কথা দেবেন না; (৪) তথ্য কম থাকলে একবারে শুধু সবচেয়ে প্রয়োজনীয় একটি প্রশ্ন করুন; (৫) ভাষা হবে সহজ, উষ্ণ ও পেশাদার বাংলা। ছবি বা ভয়েস এলে মনোযোগ দিয়ে নির্দিষ্ট উত্তর দিন; গাছের রোগ শুধু ছবি দেখে নিশ্চিত diagnosis বলবেন না—সম্ভাবনা ও নিরাপদ করণীয় সংক্ষেপে বলবেন। কেবল প্রাসঙ্গিক হলে উপযুক্ত পণ্য প্রস্তাব করুন, চাপ বা মিথ্যা দাবি নয়। ব্যবসার নাম/ফোন/ঠিকানা চাইলে শুধু চাওয়া তথ্য দিন। প্রোডাক্টের দাম/স্টক কখনো অনুমান করবেন না; search_products দিয়ে যাচাই করুন। ডেলিভারি চার্জের বর্তমান rules: ${JSON.stringify(shop.rules)}। COD আছে। অর্ডারের জন্য নাম, ১১ ডিজিটের মোবাইল, পূর্ণ ঠিকানা, প্রোডাক্ট ও quantity সংগ্রহ করুন। সব তথ্য নিয়ে subtotal + delivery সহ মোট জানিয়ে স্পষ্ট সম্মতির পরই create_order ব্যবহার করবেন। ${allowCreateOrder ? "এই বার্তায় সম্মতি পাওয়া গেছে ধরে নিতে পারেন, তবে তথ্য সম্পূর্ণ হতে হবে।" : "এই বার্তায় create_order ব্যবহার করা যাবে না।"}`;
  const declarations: any[] = [{ name: "search_products", description: "শপের active products খুঁজে দাম, stock ও তথ্য যাচাই করুন", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }];
  if (allowCreateOrder) declarations.push({ name: "create_order", description: "প্রয়োজনীয় customer তথ্য ও product নিশ্চিত হওয়ার পর অর্ডার তৈরি করুন", parameters: { type: "OBJECT", properties: { customer_name: { type: "STRING" }, customer_phone: { type: "STRING" }, customer_address: { type: "STRING" }, inside_dhaka: { type: "BOOLEAN" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { product_name: { type: "STRING" }, quantity: { type: "NUMBER" } }, required: ["product_name", "quantity"] } } }, required: ["customer_name", "customer_phone", "customer_address", "inside_dhaka", "items"] } });
  const shownProducts = new Map<string, ProductResult>();
  let createdOrder: { order_id?: string; invoice_no?: string | null; total?: number } | null = null;
  for (let round = 0; round < 4; round++) {
    const json = await callGemini({
      model,
      systemInstruction: { parts: [{ text: system }] },
      contents: messages,
      tools: [{ functionDeclarations: declarations }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 600 },
    });
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
