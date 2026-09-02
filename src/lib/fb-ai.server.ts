// Server-only AI reply engine for Facebook Messenger / comments.
// Uses the Lovable AI Gateway (chat completions) with tool calling so the
// assistant can look up products, quote delivery and place real orders.
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export type AiReplyResult = {
  text: string | null;
  needsHuman: boolean;
  orderId: string | null;
};

type DeliverySettings = { inside: number; outside: number; free_above: number };

async function loadShopContext(): Promise<{ siteName: string; delivery: DeliverySettings }> {
  const { data } = await supabaseAdmin.from("site_settings").select("settings").limit(1).maybeSingle();
  const s = (data?.settings as Record<string, unknown> | null) || {};
  return {
    siteName: (s.site_name as string) || "Sheikh Seeds",
    delivery: {
      inside: Number(s.delivery_charge_inside ?? 60),
      outside: Number(s.delivery_charge_outside ?? 130),
      free_above: Number(s.free_delivery_above ?? 0),
    },
  };
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_products",
      description: "শপের প্রোডাক্ট খুঁজে দাম ও স্টক জানায়। কাস্টমার কোনো প্রোডাক্টের নাম/দাম জিজ্ঞেস করলে ব্যবহার করুন।",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "প্রোডাক্টের নাম বা কীওয়ার্ড" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_order",
      description:
        "কাস্টমারের নাম, ফোন, পূর্ণ ঠিকানা ও প্রোডাক্ট নিশ্চিত হওয়ার পর অর্ডার তৈরি করে। তথ্য অসম্পূর্ণ থাকলে ব্যবহার করবেন না।",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          customer_phone: { type: "string", description: "১১ ডিজিটের বাংলাদেশি নাম্বার" },
          customer_address: { type: "string", description: "পূর্ণ ঠিকানা (গ্রাম/এলাকা, থানা, জেলা)" },
          inside_dhaka: { type: "boolean", description: "ঠিকানা ঢাকার ভেতরে হলে true" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string" },
                quantity: { type: "number" },
              },
              required: ["product_name", "quantity"],
            },
          },
          note: { type: "string" },
        },
        required: ["customer_name", "customer_phone", "customer_address", "inside_dhaka", "items"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalate_to_human",
      description: "অভিযোগ, রিফান্ড, বা এমন কিছু যা আপনি সমাধান করতে পারছেন না — মানুষ কর্মীকে জানানোর জন্য।",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  },
];

async function runSearchProducts(query: string) {
  const q = (query || "").trim();
  const { data } = await supabaseAdmin
    .from("products")
    .select("name,price,sale_price,stock,slug,short_description")
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .limit(8);
  if (data && data.length) return data;
  const { data: fallback } = await supabaseAdmin
    .from("products")
    .select("name,price,sale_price,stock,slug,short_description")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .limit(8);
  return fallback ?? [];
}

async function runCreateOrder(args: {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  inside_dhaka: boolean;
  items: { product_name: string; quantity: number }[];
  note?: string;
}): Promise<{ ok: boolean; order_id?: string; invoice_no?: string | null; total?: number; error?: string; duplicate?: boolean }> {
  const { delivery } = await loadShopContext();
  const rows: { product_id: string | null; product_name: string; price: number; quantity: number; subtotal: number }[] = [];

  for (const item of args.items.slice(0, 20)) {
    const qty = Math.max(1, Math.min(100, Math.round(Number(item.quantity) || 1)));
    const { data: match } = await supabaseAdmin
      .from("products")
      .select("id,name,price,sale_price")
      .eq("is_active", true)
      .ilike("name", `%${item.product_name.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (!match) return { ok: false, error: `"${item.product_name}" নামের প্রোডাক্ট পাওয়া যায়নি` };
    const price = Number(match.sale_price ?? match.price);
    rows.push({ product_id: match.id, product_name: match.name, price, quantity: qty, subtotal: price * qty });
  }

  if (!rows.length) return { ok: false, error: "কোনো প্রোডাক্ট নেই" };

  const subtotal = rows.reduce((sum, r) => sum + r.subtotal, 0);
  const baseFee = args.inside_dhaka ? delivery.inside : delivery.outside;
  const fee = delivery.free_above > 0 && subtotal >= delivery.free_above ? 0 : baseFee;

  // Duplicate guard: the same customer must not get several identical orders
  // when the AI (or a retried sync pass) calls create_order more than once.
  const phone = args.customer_phone.replace(/\D+/g, "").slice(-11);
  if (phone.length >= 6) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("orders")
      .select("id,invoice_no,total,created_at")
      .eq("source", "messenger")
      .ilike("customer_phone", `%${phone}%`)
      .is("deleted_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Math.abs(Number(recent.total) - (subtotal + fee)) < 0.01) {
      return {
        ok: true,
        order_id: recent.id,
        invoice_no: recent.invoice_no,
        total: Number(recent.total),
        duplicate: true,
      };
    }
  }


  const { allocateInvoiceNo } = await import("@/lib/invoice-no.server");
  const invoiceNo = await allocateInvoiceNo();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      invoice_no: invoiceNo,
      customer_name: args.customer_name.slice(0, 255),
      customer_phone: args.customer_phone.replace(/\s+/g, "").slice(0, 32),
      customer_address: args.customer_address.slice(0, 1000),
      notes: args.note ? `Messenger AI: ${args.note}`.slice(0, 2000) : "Messenger AI অর্ডার",
      subtotal,
      delivery_fee: fee,
      discount: 0,
      total: subtotal + fee,
      source: "messenger",
      status: "pending",
      payment_method: "cod",
    })
    .select("id,invoice_no,total")
    .single();

  if (error || !order) return { ok: false, error: error?.message ?? "অর্ডার তৈরি ব্যর্থ" };

  const { error: itemErr } = await supabaseAdmin
    .from("order_items")
    .insert(rows.map((r) => ({ ...r, order_id: order.id })));
  if (itemErr) {
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: itemErr.message };
  }

  return { ok: true, order_id: order.id, invoice_no: order.invoice_no, total: Number(order.total) };
}

export async function generateAiReply(opts: {
  history: { direction: string; text: string | null }[];
  incoming: string;
  extraPrompt?: string;
  allowOrders: boolean;
  channel: "messenger" | "comment";
  existingOrder?: { invoice_no: string | null; total: number } | null;
}): Promise<AiReplyResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { text: null, needsHuman: true, orderId: null };

  const { siteName, delivery } = await loadShopContext();

  const system = [
    `আপনি ${siteName} নামের বাংলাদেশি বীজ ও কৃষি পণ্যের অনলাইন শপের কাস্টমার সাপোর্ট এজেন্ট।`,
    "সবসময় বাংলায়, ছোট ও ভদ্র উত্তর দিন (৩-৪ লাইনের মধ্যে)। ইমোজি অল্প ব্যবহার করুন।",
    `ডেলিভারি চার্জ: ঢাকার ভেতরে ৳${delivery.inside}, ঢাকার বাইরে ৳${delivery.outside}। পেমেন্ট: ক্যাশ অন ডেলিভারি।`,
    "দাম বা প্রোডাক্টের প্রশ্নে অনুমান করবেন না — search_products টুল ব্যবহার করুন।",
    opts.allowOrders
      ? "কাস্টমার অর্ডার করতে চাইলে নাম, মোবাইল নাম্বার ও পূর্ণ ঠিকানা চেয়ে নিন, তারপর create_order টুল একবারই ব্যবহার করুন এবং ইনভয়েস নাম্বার জানিয়ে দিন। একই অর্ডারের জন্য কখনো দুইবার create_order ডাকবেন না এবং একবারই কনফার্মেশন মেসেজ দিবেন।"
      : "অর্ডার নিতে পারবেন না — কাস্টমারকে ওয়েবসাইটে অর্ডার করতে বলুন।",
    opts.existingOrder
      ? `এই কাস্টমারের অর্ডার ইতিমধ্যে কনফার্ম হয়েছে (ইনভয়েস ${opts.existingOrder.invoice_no ?? "-"}, মোট ৳${opts.existingOrder.total})। আবার অর্ডার তৈরি করবেন না বা আবার কনফার্মেশন পাঠাবেন না — কাস্টমার স্পষ্টভাবে নতুন/অতিরিক্ত প্রোডাক্ট চাইলে শুধু তখনই নতুন অর্ডার নিবেন।`
      : "",
    opts.channel === "comment"
      ? "এটি একটি ফেসবুক পোস্টের কমেন্টের উত্তর — খুব সংক্ষেপে (১-২ লাইন) উত্তর দিন এবং ইনবক্সে মেসেজ দিতে বলুন।"
      : "",
    opts.extraPrompt ?? "",
  ]

    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...opts.history.slice(-14).map((m) => ({
      role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant",
      content: m.text ?? "",
    })),
    { role: "user", content: opts.incoming },
  ];

  let needsHuman = false;
  let orderId: string | null = null;

  for (let step = 0; step < 6; step++) {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: MODEL, messages, tools }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[fb-ai] gateway error [${res.status}]: ${body}`);
      return { text: null, needsHuman: true, orderId };
    }

    const json = (await res.json()) as {
      choices?: { message?: ChatMessage }[];
    };
    const msg = json.choices?.[0]?.message;
    if (!msg) return { text: null, needsHuman: true, orderId };

    if (msg.tool_calls?.length) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let result: unknown;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        try {
          if (call.function.name === "search_products") {
            result = await runSearchProducts(String(args.query ?? ""));
          } else if (call.function.name === "create_order") {
            if (!opts.allowOrders) {
              result = { ok: false, error: "অর্ডার নেওয়া বন্ধ আছে" };
            } else if (orderId) {
              // One conversation turn creates at most one order.
              result = { ok: true, order_id: orderId, duplicate: true, note: "এই অর্ডারটি আগেই তৈরি হয়েছে" };
            } else {
              const created = await runCreateOrder(args as Parameters<typeof runCreateOrder>[0]);
              if (created.ok && created.order_id) orderId = created.order_id;
              result = created;
            }

          } else if (call.function.name === "escalate_to_human") {
            needsHuman = true;
            result = { ok: true };
          } else {
            result = { error: "unknown tool" };
          }
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "tool failed" };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return { text: msg.content?.trim() || null, needsHuman, orderId };
  }

  return { text: null, needsHuman: true, orderId };
}
