import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import { buildTrainingPrompt, emptyFbPageConfig, type FbFaq, type FbPageConfig } from "@/lib/fb-page.server";

type TrainerResult = {
  reply: string;
  learned: FbFaq | null;
};

export type TrainerRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  learned_q: string | null;
  learned_a: string | null;
  created_at: string;
};

export async function listTrainerChat(limit = 200): Promise<TrainerRow[]> {
  const { data, error } = await supabaseAdmin
    .from("fb_trainer_messages")
    .select("id,role,content,image_url,learned_q,learned_a,created_at")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TrainerRow[];
}

export async function clearTrainerChat() {
  const { error } = await supabaseAdmin.from("fb_trainer_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Chat with the AI training director. History is loaded from (and saved to) the DB. */
export async function talkToFbTrainer(message: string, imageUrl?: string | null): Promise<TrainerResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI সার্ভিস এখন প্রস্তুত নেই");

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "facebook_page")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const cfg = { ...emptyFbPageConfig, ...((data?.config as Partial<FbPageConfig> | null) ?? {}) };
  const currentTraining = buildTrainingPrompt(cfg);
  const system = [
    "আপনি Sheikh Seedsের AI ট্রেনিং ডিরেক্টর। অ্যাডমিন আপনার সাথে স্বাভাবিক বাংলায় কথা বলে কাস্টমার-সাপোর্ট AI-কে শেখাবেন।",
    "প্রথমে কথাটি বুঝে সংক্ষিপ্তভাবে নিশ্চিত করুন। কোনো তথ্য অস্পষ্ট হলে একটি ছোট প্রশ্ন করুন।",
    "ছবি দিলে ছবির ভেতরের তথ্য (প্রাইস লিস্ট, পণ্যের নাম, নিয়ম) পড়ে শিখুন।",
    "যখন অ্যাডমিন স্পষ্টভাবে একটি কাস্টমার প্রশ্নের উত্তর/নীতি শেখান, তখন learned অবজেক্টে একটি স্বয়ংসম্পূর্ণ প্রশ্ন ও সঠিক উত্তর দিন। অন্যথায় learned হবে null।",
    "শুধু JSON দিন: {\"reply\":\"বাংলা উত্তর\",\"learned\":null অথবা {\"q\":\"প্রশ্ন\",\"a\":\"উত্তর\"}}",
    currentTraining ? `বর্তমান ট্রেনিং:\n${currentTraining}` : "বর্তমানে আলাদা ট্রেনিং নেই।",
  ].join("\n\n");

  const past = await listTrainerChat(40);
  const history = past.slice(-24).map((row) => ({
    role: row.role,
    content: row.image_url ? `${row.content} [ছবি সংযুক্ত ছিল]` : row.content,
  }));

  const userContent = imageUrl
    ? ([
        { type: "text", text: message || "এই ছবিটি থেকে শিখুন।" },
        { type: "image_url", image_url: { url: imageUrl } },
      ] as const)
    : message;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        ...history,
        { role: "user", content: userContent },
      ],
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`AI উত্তর দিতে পারেনি (${res.status})`);

  let parsed: TrainerResult;
  try {
    const envelope = JSON.parse(body) as { choices?: { message?: { content?: string } }[] };
    parsed = JSON.parse(envelope.choices?.[0]?.message?.content ?? "{}") as TrainerResult;
  } catch {
    throw new Error("AI-এর উত্তর বোঝা যায়নি, আবার লিখুন");
  }

  const learned = parsed.learned?.q?.trim() && parsed.learned?.a?.trim()
    ? { q: parsed.learned.q.trim().slice(0, 300), a: parsed.learned.a.trim().slice(0, 1500) }
    : null;
  if (learned) {
    const faqs = [...(cfg.faqs ?? [])];
    const duplicate = faqs.findIndex((item) => item.q.trim().toLocaleLowerCase() === learned.q.toLocaleLowerCase());
    if (duplicate >= 0) faqs[duplicate] = learned;
    else faqs.push(learned);
    const next = { ...(data?.config as Record<string, unknown> | null), faqs: faqs.slice(-100) };
    const { error: saveError } = await supabaseAdmin.from("integrations").upsert(
      { name: "facebook_page", is_active: data?.is_active ?? true, config: next as never, updated_at: new Date().toISOString() },
      { onConflict: "name" },
    );
    if (saveError) throw new Error(saveError.message);
  }

  const reply = parsed.reply?.trim() || "বুঝেছি। আরেকটু বিস্তারিত বলুন।";
  await supabaseAdmin.from("fb_trainer_messages").insert([
    { role: "user", content: message || (imageUrl ? "[ছবি]" : ""), image_url: imageUrl ?? null },
    { role: "assistant", content: reply, learned_q: learned?.q ?? null, learned_a: learned?.a ?? null },
  ]);

  return { reply, learned };
}
