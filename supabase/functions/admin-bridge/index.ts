import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const PURCHASE_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_conversion.purchase",
  "purchase",
  "omni_purchase",
  "web_in_store_purchase",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function dhakaDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date range");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date);
}

function findPurchase(items: unknown[]) {
  for (const type of PURCHASE_PRIORITY) {
    const item = items.find((row: any) => String(row?.action_type ?? "") === type);
    if (item) return item as any;
  }
  return null;
}

async function graphJson(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        const message = payload?.error?.message || ("Meta request failed with HTTP " + response.status);
        const error = new Error(message);
        if ([400, 401, 403].includes(response.status)) throw error;
        lastError = error;
      } else {
        return payload;
      }
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (/invalid token|access token|permission|oauth|unauthorized|forbidden/.test(message)) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw lastError instanceof Error ? lastError : new Error("Meta request failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  const authorization = req.headers.get("authorization") || "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: "Unauthorized" }, 401);

  const { data: roleRows, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) return json({ error: roleError.message }, 500);

  const roles = new Set((roleRows ?? []).map((row: any) => String(row.role)));
  let allowed = roles.has("super_admin") || roles.has("admin");
  if (!allowed && roles.has("employee")) {
    const { data: permission } = await admin
      .from("employee_permissions")
      .select("dashboard,dashboard_meta_ads,dash_ads")
      .eq("user_id", userId)
      .maybeSingle();
    allowed = Boolean(permission?.dashboard && (permission?.dashboard_meta_ads || permission?.dash_ads));
  }
  if (!allowed) return json({ error: "Forbidden" }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (body?.action !== "meta_dashboard") return json({ error: "Unsupported action" }, 400);

  let since: string;
  let until: string;
  try {
    since = dhakaDate(String(body.from ?? ""));
    until = dhakaDate(String(body.to ?? ""));
  } catch {
    return json({ error: "Invalid date range" }, 400);
  }

  const { data: integration, error: integrationError } = await admin
    .from("integrations")
    .select("config,is_active")
    .eq("name", "meta_ad_account")
    .maybeSingle();

  if (integrationError) return json({ error: integrationError.message }, 500);
  const cfg = (integration?.config ?? {}) as Record<string, unknown>;
  const accessToken = String(cfg.access_token ?? "").trim();
  const accountId = String(cfg.ad_account_id ?? cfg.account_id ?? "").replace(/^act_/, "").trim();

  if (!integration?.is_active || !accessToken || !accountId) {
    return json({ connected: false, error: "Meta Ad Account is not connected" });
  }

  const cacheKey = "meta_dashboard|" + accountId + "|" + since + "|" + until;
  const { data: cached } = await admin
    .from("meta_ads_cache")
    .select("payload,fetched_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached?.payload && cached?.fetched_at) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age >= 0 && age < 60_000) return json({ ...(cached.payload as object), cached: true });
  }

  try {
    const version = "v23.0";
    const base = "https://graph.facebook.com/" + version + "/act_" + encodeURIComponent(accountId);
    const auth = "access_token=" + encodeURIComponent(accessToken);
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
    const accountUrl = base + "?fields=name,account_id,spend_cap,amount_spent,currency,account_status&" + auth;
    const insightsUrl = base + "/insights?fields=spend,actions,cost_per_action_type&time_range=" + timeRange + "&level=account&" + auth;

    const [accountJson, insightsJson] = await Promise.all([
      graphJson(accountUrl),
      graphJson(insightsUrl),
    ]);

    const insight = insightsJson?.data?.[0] ?? {};
    const actions = Array.isArray(insight.actions) ? insight.actions : [];
    const costs = Array.isArray(insight.cost_per_action_type) ? insight.cost_per_action_type : [];
    const purchaseAction = findPurchase(actions);
    const purchaseCost = findPurchase(costs);
    const purchases = purchaseAction ? Number(purchaseAction.value || 0) : 0;
    const spend = Number(insight.spend || 0);
    const costPerPurchase = purchaseCost
      ? Number(purchaseCost.value || 0)
      : purchases > 0
        ? spend / purchases
        : 0;

    const amountSpent = Number(accountJson.amount_spent || 0) / 100;
    const capRaw = Number(accountJson.spend_cap);
    const spendingCap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw / 100 : null;
    const spendingLimit = spendingCap == null ? null : Math.max(0, spendingCap - amountSpent);

    const payload = {
      connected: true,
      accountName: accountJson.name || String(cfg.account_name ?? "Meta Ad Account"),
      accountId: accountJson.account_id || accountId,
      currency: accountJson.currency || "USD",
      spend,
      purchases,
      costPerPurchase,
      spendingLimit,
      spendingCap,
      accountAmountSpent: amountSpent,
      accountStatus: accountJson.account_status,
      since,
      until,
      source: "Meta Graph API / Account Insights",
      purchaseActionType: purchaseAction?.action_type || null,
      attribution: "unified",
      fetchedAt: new Date().toISOString(),
    };

    await admin.from("meta_ads_cache").upsert(
      { cache_key: cacheKey, payload, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

    return json(payload);
  } catch (error) {
    if (cached?.payload) {
      return json({
        ...(cached.payload as object),
        cached: true,
        stale: true,
        warning: error instanceof Error ? error.message : "Live Meta request failed",
      });
    }
    return json({ connected: false, error: error instanceof Error ? error.message : "Meta Ads request failed" }, 502);
  }
});
