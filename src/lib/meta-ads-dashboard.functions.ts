import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime(), accountKey: z.enum(["meta_ad_account", "meta_ad_account_2"]).default("meta_ad_account") });

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

    const accountKeys = ["meta_ad_account", "meta_ad_account_2"] as const;
    const { data: integrations, error: integrationError } = await db
      .from("integrations")
      .select("name,config,is_active")
      .in("name", accountKeys);
    if (integrationError) throw new Error(integrationError.message);

    const accountOptions = accountKeys.map((key, index) => {
      const row = (integrations ?? []).find((item: any) => item.name === key);
      const config = (row?.config ?? {}) as MetaConfig & { demo_name?: string };
      return {
        key,
        label: String(config.demo_name || config.account_name || (index === 0 ? "Ad Account 1" : "Ad Account 2")),
        connected: !!row?.is_active && !!String(config.access_token ?? "").trim() && !!String(config.ad_account_id ?? config.account_id ?? "").trim(),
      };
    });
    const integration = (integrations ?? []).find((item: any) => item.name === data.accountKey);
    const cfg = ((integration?.config ?? {}) as MetaConfig);
    const token = String(cfg.access_token ?? "").trim();
    const accountId = String(cfg.ad_account_id ?? cfg.account_id ?? "").replace(/^act_/, "").trim();

    if (!integration?.is_active || !token || !accountId) {
      return { connected: false, error: "Selected Meta Ad Account is not connected", accountOptions, selectedAccountKey: data.accountKey };
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
          accountOptions,
          selectedAccountKey: data.accountKey,
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
      accountOptions,
      selectedAccountKey: data.accountKey,
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


/**
 * Read-only ad inventory for Oronno Nogor. This endpoint never writes to Meta.
 * Only admins can call it; the stored token stays server-side and is never returned.
 */
export const getOronnoNogorAdsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: roleRows, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    const roles = new Set((roleRows ?? []).map((row: any) => String(row.role)));
    if (!roles.has("admin") && !roles.has("super_admin")) throw new Error("Forbidden");

    const { data: integration, error: integrationError } = await db
      .from("integrations")
      .select("name,config,is_active")
      .eq("name", "meta_ad_account_2")
      .maybeSingle();
    if (integrationError) throw new Error(integrationError.message);

    const cfg = (integration?.config ?? {}) as MetaConfig;
    const token = String(cfg.access_token ?? "").trim();
    const accountId = String(cfg.ad_account_id ?? cfg.account_id ?? "").replace(/^act_/, "").trim();
    if (!integration?.is_active || !token || !accountId) throw new Error("Oronno Nogor Ad Account is not connected");

    const params = new URLSearchParams({
      fields: "id,name,status,effective_status,campaign{name}",
      limit: "500",
      access_token: token,
    });
    let nextUrl: string | null = `https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}/ads?${params.toString()}`;
    const ads: any[] = [];
    let pages = 0;
    while (nextUrl && pages < 100) {
      const url = new URL(nextUrl);
      if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") throw new Error("Unexpected Meta pagination URL");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      let response: Response;
      try {
        response = await fetch(url.toString(), { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error?.message || `Meta ads request failed with HTTP ${response.status}`);
      }
      if (Array.isArray(payload?.data)) ads.push(...payload.data);
      nextUrl = typeof payload?.paging?.next === "string" ? payload.paging.next : null;
      pages += 1;
    }

    const rows = ads.map((ad: any) => {
      const status = String(ad?.status ?? "UNKNOWN").toUpperCase();
      const effectiveStatus = String(ad?.effective_status ?? status).toUpperCase();
      const isOn = effectiveStatus === "ACTIVE";
      const isOff = ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "DELETED"].includes(effectiveStatus)
        || ["PAUSED", "ARCHIVED", "DELETED"].includes(status);
      return {
        id: String(ad?.id ?? ""),
        name: String(ad?.name ?? "Unnamed ad"),
        campaignName: String(ad?.campaign?.name ?? ""),
        status,
        effectiveStatus,
        state: isOn ? "On" : isOff ? "Off" : "Other",
      };
    });

    return {
      accountName: String((cfg as any).demo_name || cfg.account_name || "Oronno Nogor"),
      total: rows.length,
      onCount: rows.filter((ad) => ad.state === "On").length,
      offCount: rows.filter((ad) => ad.state === "Off").length,
      otherCount: rows.filter((ad) => ad.state === "Other").length,
      truncated: !!nextUrl,
      ads: rows,
      fetchedAt: new Date().toISOString(),
    };
  });
