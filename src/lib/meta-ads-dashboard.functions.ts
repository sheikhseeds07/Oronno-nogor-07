import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

type MetaConfig = {
  access_token?: string;
  ad_account_id?: string;
  account_id?: string;
  account_name?: string;
};

const PURCHASE_PRIORITY = [
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_conversion.purchase",
  "purchase",
  "omni_purchase",
  "web_in_store_purchase",
];

const dhakaDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));

const findPurchase = (items: any[]) => {
  for (const type of PURCHASE_PRIORITY) {
    const item = items.find((row: any) => String(row?.action_type ?? "") === type);
    if (item) return item;
  }
  return null;
};

async function graphJson(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        const message = payload?.error?.message || `Meta request failed with HTTP ${response.status}`;
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
      clearTimeout(timeout);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw lastError instanceof Error ? lastError : new Error("Meta request failed");
}

export const getMetaAdsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;

    const { data: roleRows, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);

    const roles = new Set((roleRows ?? []).map((row: any) => String(row.role)));
    if (!roles.has("admin") && !roles.has("super_admin")) {
      return { connected: false, error: "Meta Ads is available to admin accounts" };
    }

    const { data: integration, error: integrationError } = await db
      .from("integrations")
      .select("config,is_active")
      .eq("name", "meta_ad_account")
      .maybeSingle();
    if (integrationError) throw new Error(integrationError.message);

    const cfg = ((integration?.config ?? {}) as MetaConfig);
    const token = String(cfg.access_token ?? "").trim();
    const accountId = String(cfg.ad_account_id ?? cfg.account_id ?? "").replace(/^act_/, "").trim();

    if (!integration?.is_active || !token || !accountId) {
      return { connected: false, error: "Meta Ad Account is not connected" };
    }

    const since = dhakaDate(data.from);
    const until = dhakaDate(data.to);
    const version = "v23.0";
    const base = `https://graph.facebook.com/${version}/act_${encodeURIComponent(accountId)}`;
    const auth = `access_token=${encodeURIComponent(token)}`;
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

    let accountJson: any;
    let insightsJson: any;
    try {
      [accountJson, insightsJson] = await Promise.all([
        graphJson(`${base}?fields=name,account_id,spend_cap,amount_spent,currency,account_status&${auth}`),
        graphJson(`${base}/insights?fields=spend,actions,cost_per_action_type&time_range=${timeRange}&level=account&${auth}`),
      ]);
    } catch (liveError) {
      // Migration-safe fallback: the restored DB already contains successful
      // Meta dashboard snapshots. Do not show "not connected" just because a
      // live Graph request or an old Edge Function is temporarily unavailable.
      const key = `meta_dashboard|${accountId}|${since}|${until}`;
      const { data: cached } = await db
        .from("meta_ads_cache")
        .select("payload,fetched_at")
        .eq("cache_key", key)
        .maybeSingle();

      if (cached?.payload?.connected) {
        return {
          ...cached.payload,
          connected: true,
          cached: true,
          fetchedAt: cached.payload.fetchedAt || cached.fetched_at,
          liveError: liveError instanceof Error ? liveError.message : "Meta live request unavailable",
        };
      }

      throw liveError;
    }

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

    return {
      connected: true,
      accountName: accountJson.name || cfg.account_name || "Meta Ad Account",
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
      fetchedAt: new Date().toISOString(),
    };
  });
