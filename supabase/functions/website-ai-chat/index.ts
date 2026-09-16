// Gemini proxy for the website live chat.
// The Gemini API key stays server-side here (edge secret or site_ai_settings via
// service role). The website worker sends only the prompt/tool payload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "gemini-flash-latest";
const MODEL_FALLBACKS = [DEFAULT_MODEL, "gemini-3.5-flash", "gemini-flash-lite-latest"];
const RETIRED = /^gemini-(1\.5|2\.0|2\.5)/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function loadConfig() {
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
  return { apiKey, model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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
  if (JSON.stringify(payload).length > 200_000) return json({ error: "Payload too large" }, 413);

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
        body: JSON.stringify({
          ...(payload.systemInstruction ? { systemInstruction: payload.systemInstruction } : {}),
          contents,
          ...(payload.tools ? { tools: payload.tools } : {}),
          generationConfig: payload.generationConfig ?? { temperature: 0.75, maxOutputTokens: 1500 },
        }),
      },
    );
    const body = await response.json().catch(() => null);
    if (response.ok) return json({ ...body, model: candidate });
    lastError = { status: response.status, body };
    // Retired, rate-limited or overloaded model: try the next one.
    if (!(response.status === 404 || response.status === 429 || response.status >= 500)) break;
  }
  const message =
    (lastError.body as { error?: { message?: string } } | null)?.error?.message ??
    `Gemini API ${lastError.status}`;
  return json({ error: message }, lastError.status >= 400 ? lastError.status : 502);
});
