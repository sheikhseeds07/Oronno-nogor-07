import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const DEFAULT_MODEL = "gemini-2.5-flash";

type Msg = { role: "user" | "model"; parts: { text: string }[] };
type Item = { product_name: string; quantity: number };

async function getConfig() {
  const { data } = await supabaseAdmin.from("site_ai_settings").select("api_key,model").limit(1).maybeSingle();
  return { apiKey: data?.api_key || process.env.GEMINI_API_KEY || "", model: data?.model || process.env.GEMINI_MODEL || DEFAULT_MODEL };
}

async function shopContext() {
  const { data } = await supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle();
  const s = (data?.settings as Record<string, unknown> | null) ?? {};
  return { name: String(s.site_name || "Sheikh Seeds"), inside: Number(s.delivery_charge_inside ?? 60), outside: Number(s.delivery_charge_outside ?? 130), free: Number(s.free_delivery_above ?? 0) };
}

async function searchProducts(query: string) {
  const q = query.trim();
  const { data } = await supabaseAdmin.from("products").select("id,name,price,sale_price,stock,slug,short_description").eq("is_active", true).ilike("name", `%${q}%`).limit(10);
  if (data?.length) return data;
  const { data: fallback } = await supabaseAdmin.from("products").select("id,name,price,sale_price,stock,slug,short_description").eq("is_active", true).order("is_featured", { ascending: false }).limit(10);
  return fallback ?? [];
}

async function createOrder(args: { customer_name: string; customer_phone: string; customer_address: string; inside_dhaka: boolean; items: Item[] }) {
  const shop = await shopContext();
  const rows: Array<{ product_id: string; product_name: string; price: number; quantity: number; subtotal: number }> = [];
  for (const item of args.items.slice(0, 20)) {
    const matches = await searchProducts(item.product_name);
    const match = matches.find((p) => p.name.toLowerCase().includes(item.product_name.toLowerCase())) ?? matches[0];
    if (!match) return { ok: false, error: `${item.product_name} পাওয়া যায়নি` };
    const price = Number(match.sale_price ?? match.price);
    const quantity = Math.max(1, Math.min(100, Math.round(Number(item.quantity) || 1)));
    rows.push({ product_id: match.id, product_name: match.name, price, quantity, subtotal: price * quantity });
  }
  if (!rows.length) return { ok: false, error: "কোনো প্রোডাক্ট নেই" };
  const subtotal = rows.reduce((a, r) => a + r.subtotal, 0);
  const delivery = shop.free > 0 && subtotal >= shop.free ? 0 : args.inside_dhaka ? shop.inside : shop.outside;
  const phone = args.customer_phone.replace(/\D/g, "").slice(-11);
  if (phone.length >= 6) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin.from("orders").select("id,invoice_no,total").eq("source", "web").ilike("customer_phone", `%${phone}%`).is("deleted_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent && Math.abs(Number(recent.total) - subtotal - delivery) < 0.01) return { ok: true, duplicate: true, invoice_no: recent.invoice_no, total: Number(recent.total), order_id: recent.id };
  }
  const { allocateInvoiceNo } = await import("@/lib/invoice-no.server");
  const invoiceNo = await allocateInvoiceNo();
  const { data: order, error } = await supabaseAdmin.from("orders").insert({ invoice_no: invoiceNo, customer_name: args.customer_name.slice(0, 255), customer_phone: args.customer_phone.replace(/\s+/g, "").slice(0, 32), customer_address: args.customer_address.slice(0, 1000), notes: "Website Gemini AI অর্ডার", subtotal, delivery_fee: delivery, discount: 0, total: subtotal + delivery, source: "web", status: "pending", payment_method: "cod" }).select("id,invoice_no,total").single();
  if (error || !order) return { ok: false, error: error?.message || "অর্ডার তৈরি হয়নি" };
  const { error: itemError } = await supabaseAdmin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
  if (itemError) { await supabaseAdmin.from("orders").delete().eq("id", order.id); return { ok: false, error: itemError.message }; }
  return { ok: true, order_id: order.id, invoice_no: order.invoice_no, total: Number(order.total) };
}

export async function generateGeminiWebReply(input: { incoming: string; history: { direction: string; text: string | null }[] }) {
  const { apiKey, model } = await getConfig();
  if (!apiKey) throw new Error("Gemini API key configured হয়নি");
  const shop = await shopContext();
  let messages: Msg[] = input.history.slice(-12).filter((m) => m.text).map((m) => ({ role: m.direction === "in" ? "user" : "model", parts: [{ text: m.text! }] }));
  messages.push({ role: "user", parts: [{ text: input.incoming }] });
  const system = `আপনি ${shop.name}-এর ওয়েবসাইটের লাইভ AI কাস্টমার কেয়ার ও সেলস সহকারী। মানুষের মতো স্বাভাবিক, বন্ধুসুলভ বাংলা ভাষায় উত্তর দেবেন। রোবটের মতো লম্বা তালিকা বা অপ্রয়োজনীয় কথা নয়। কাস্টমারের প্রশ্ন বুঝে ছোট, পরিষ্কার ও ব্যক্তিগত উত্তর দিন। প্রোডাক্টের দাম/স্টক অনুমান করবেন না; প্রয়োজন হলে DATABASE_CONTEXT ব্যবহার করুন। ডেলিভারি: ঢাকা ৳${shop.inside}, ঢাকা বাইরে ৳${shop.outside}, free above ৳${shop.free || 0}। COD আছে। অর্ডার নিতে নাম, ১১ ডিজিটের মোবাইল, পূর্ণ ঠিকানা, প্রোডাক্ট ও quantity সংগ্রহ করুন; সব তথ্য নিশ্চিত করে তারপর ORDER_REQUEST_JSON পাঠান। কাস্টমারের স্পষ্ট সম্মতি ছাড়া অর্ডার তৈরি করবেন না।`;
  const tools = [{ functionDeclarations: [{ name: "search_products", description: "শপের active products খুঁজুন", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } }, { name: "create_order", description: "শুধু customer-এর স্পষ্ট সম্মতির পর অর্ডার তৈরি করুন", parameters: { type: "OBJECT", properties: { customer_name: { type: "STRING" }, customer_phone: { type: "STRING" }, customer_address: { type: "STRING" }, inside_dhaka: { type: "BOOLEAN" }, items: { type: "ARRAY", items: { type: "OBJECT", properties: { product_name: { type: "STRING" }, quantity: { type: "NUMBER" } }, required: ["product_name", "quantity"] } } }, required: ["customer_name", "customer_phone", "customer_address", "inside_dhaka", "items"] } }] }];
  for (let round = 0; round < 4; round++) {
    const body: any = { systemInstruction: { parts: [{ text: system }] }, contents: messages, tools, generationConfig: { temperature: 0.7, maxOutputTokens: 500 } };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json: any = await response.json();
    if (!response.ok) throw new Error(json?.error?.message || `Gemini API ${response.status}`);
    const candidate = json?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls = parts.filter((p: any) => p.functionCall);
    if (!calls.length) return String(parts.find((p: any) => p.text)?.text || "").trim();
    messages.push({ role: "model", parts });
    for (const p of calls) {
      const name = p.functionCall.name;
      const args = p.functionCall.args ?? {};
      let result: unknown;
      if (name === "search_products") result = await searchProducts(String(args.query || ""));
      else if (name === "create_order") result = await createOrder(args);
      else result = { error: "Unknown function" };
      messages.push({ role: "user", parts: [{ text: `TOOL_RESULT ${name}: ${JSON.stringify(result)}` }] });
    }
  }
  throw new Error("AI response loop exceeded");
}
