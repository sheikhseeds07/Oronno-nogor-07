import { createRateLimiter } from "../_shared/rate-limit.ts";
const allowChat = createRateLimiter();
// Gemini proxy for the website live chat.
// The Gemini API key stays server-side here (edge secret or site_ai_settings via
// service role). The website worker sends only the prompt/tool payload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MODEL_FALLBACKS = [DEFAULT_MODEL, "gemini-3.8-flash", "gemini-3.5-flash"];
const RETIRED = /^gemini-(1\.5|2\.0|2\.5)/;
let cachedConfig: { apiKey: string; model: string; expiresAt: number } | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function loadConfig() {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig;
  const envKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  const envModel = Deno.env.get("GEMINI_MODEL") ?? "";
  let apiKey = envKey;
  let model = envModel;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from("site_ai_settings")
      .select("api_key,model")
      .limit(1)
      .maybeSingle();
    if (data?.api_key) apiKey = data.api_key;
    if (data?.model) model = data.model;
  } catch (_) {
    // Fall back to edge secrets when the table is unavailable.
  }
  if (!model || RETIRED.test(model)) model = DEFAULT_MODEL;
  cachedConfig = { apiKey, model, expiresAt: Date.now() + 5 * 60_000 };
  return cachedConfig;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!allowChat("chat-isolate", 60, 60_000)) return new Response(JSON.stringify({ error: "Chat rate limit reached" }), { status: 429, headers: { ...CORS, "Content-Type": "application/json", "Retry-After": "60" } });

  let payload: {
    contents?: unknown[];
    systemInstruction?: unknown;
    tools?: unknown[];
    generationConfig?: unknown;
    model?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const contents = Array.isArray(payload.contents) ? payload.contents : [];
  if (!contents.length) return json({ error: "contents is required" }, 400);
  // Simple abuse guard: live chat never needs a huge transcript.
  if (contents.length > 40) return json({ error: "Conversation too long" }, 413);
  // Up to two validated 5 MB image/audio inputs arrive as base64 (~14 MB total).
  if (JSON.stringify(payload).length > 18 * 1024 * 1024) return json({ error: "Payload too large" }, 413);

  const { apiKey, model } = await loadConfig();
  if (!apiKey) return json({ error: "Gemini API key configured হয়নি" }, 400);

  const requested = payload.model && !RETIRED.test(payload.model) ? payload.model : model;
  const chain = [requested, ...MODEL_FALLBACKS.filter((m) => m !== requested)];

  let lastError = { status: 502, body: { error: { message: "Gemini API unreachable" } } as unknown };
  for (const candidate of chain) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          ...(payload.systemInstruction ? { systemInstruction: payload.systemInstruction } : {}),
          contents,
          ...(payload.tools ? { tools: payload.tools } : {}),
          generationConfig: payload.generationConfig ?? { maxOutputTokens: 320 },
        }),
      },
    );
    const body = await response.json().catch(() => null);
    if (response.ok) return json({ ...body, model: candidate });
    lastError = { status: response.status, body };
    // Only try another model for a missing model; never amplify 429/5xx.
    if (!(response.status === 404)) break;
  }
  const message =
    (lastError.body as { error?: { message?: string } } | null)?.error?.message ??
    `Gemini API ${lastError.status}`;
  return json({ error: message }, lastError.status >= 400 ? lastError.status : 502);
});
