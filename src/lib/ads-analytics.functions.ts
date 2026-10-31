import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";

const Schema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  accountKey: z.enum(["all", "meta_ad_account", "meta_ad_account_2"]).default("all"),
});

type Config = {
  access_token?: string;
  ad_account_id?: string;
  account_id?: string;
  account_name?: string;
  demo_name?: string;
  dollar_rate?: number | string;
  courier_cost_per_order?: number | string;
};

const PURCHASE_TYPES = [
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "onsite_conversion.purchase",
  "purchase",
  "omni_purchase",
  "web_in_store_purchase",
];

const dhakaDate = (value: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(value));

async function graphGet(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.error) {
      const error = json?.error;
      throw new Error(error?.message || `Meta API HTTP ${response.status}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function actionValue(items: any[] = []) {
  for (const type of PURCHASE_TYPES) {
    const found = items.find((item) => String(item?.action_type) === type);
    if (found) return Number(found.value || 0);
  }
  return 0;
}

function actionCount(items: any[] = [], types: string[]) {
  for (const type of types) {
    const found = items.find((item) => String(item?.action_type) === type);
    if (found) return Number(found.value || 0);
  }
  return 0;
}

function normalizeInsight(row: any, account: any) {
  const spend = Number(row?.spend || 0);
  const actions = Array.isArray(row?.actions) ? row.actions : [];
  const purchases = actionValue(actions);
  const purchaseValue = actionValue(Array.isArray(row?.action_values) ? row.action_values : []);
  const linkClicks = Number(row?.inline_link_clicks || actionCount(actions, ["link_click", "outbound_click"]));
  const landingPageViews = actionCount(actions, ["landing_page_view", "omni_landing_page_view"]);
  const addToCarts = actionCount(actions, ["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart", "omni_add_to_cart"]);
  const checkouts = actionCount(actions, ["offsite_conversion.fb_pixel_initiate_checkout", "initiate_checkout", "omni_initiated_checkout"]);
  return {
    ...row,
    accountName: account.accountName,
    accountKey: account.accountKey,
    currency: account.currency,
    dollarRate: account.dollarRate,
    spend,
    purchases,
    purchaseValue,
    cpa: purchases > 0 ? spend / purchases : null,
    roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
    ctr: Number(row?.ctr || 0),
    cpc: Number(row?.cpc || 0),
    cpm: Number(row?.cpm || 0),
    frequency: Number(row?.frequency || 0),
    impressions: Number(row?.impressions || 0),
    reach: Number(row?.reach || 0),
    clicks: Number(row?.clicks || 0),
    linkClicks,
    landingPageViews,
    addToCarts,
    checkouts,
  };
}

async function insights(base: string, auth: string, since: string, until: string, level: string, extra = "") {
  const fields = [
    "spend", "impressions", "reach", "frequency", "clicks", "ctr", "cpc", "cpm",
    "inline_link_clicks", "actions", "action_values", "cost_per_action_type",
    ...(level !== "account" ? ["campaign_id", "campaign_name"] : []),
    ...(level === "adset" || level === "ad" ? ["adset_id", "adset_name"] : []),
    ...(level === "ad" ? ["ad_id", "ad_name"] : []),
  ].join(",");
  const range = encodeURIComponent(JSON.stringify({ since, until }));
  const url = `${base}/insights?level=${level}&fields=${fields}&time_range=${range}&limit=500&${extra ? extra + "&" : ""}${auth}`;
  let next: string | null = url;
  const rows: any[] = [];
  let pages = 0;
  while (next && pages < 5) {
    const json = await graphGet(next);
    if (Array.isArray(json?.data)) rows.push(...json.data);
    next = typeof json?.paging?.next === "string" ? json.paging.next : null;
    pages++;
  }
  return rows;
}

export const getAdsAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rolesRows, error: rolesError } = await (context.supabase as any)
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);
    const roles = new Set((rolesRows ?? []).map((row: any) => String(row.role)));
    if (!roles.has("admin") && !roles.has("super_admin")) {
      throw new Error("Ads Analytics is available to admin accounts only");
    }

    const db = supabaseAdmin as any;
    const keys = ["meta_ad_account", "meta_ad_account_2"] as const;
    const { data: integrations, error: integrationError } = await db
      .from("integrations").select("name,config,is_active").in("name", keys);
    if (integrationError) throw new Error(integrationError.message);

    const selected = keys.filter((key) => data.accountKey === "all" || data.accountKey === key);
    const accounts = await Promise.all(selected.map(async (key) => {
      const row = (integrations ?? []).find((item: any) => item.name === key);
      const cfg = (row?.config ?? {}) as Config;
      const token = String(cfg.access_token ?? "").trim();
      const id = String(cfg.ad_account_id ?? cfg.account_id ?? "").replace(/^act_/, "").trim();
      const accountName = String(cfg.demo_name || cfg.account_name || (key === keys[0] ? "Sheikh Seeds" : "Oronno Nogor"));
      if (!row?.is_active || !token || !id) {
        return { accountKey: key, accountName, connected: false, error: "এই Ad Account-এর সংযোগ বা Access Token সেট করা নেই", currency: "USD", dollarRate: Number(cfg.dollar_rate) || 122, courierCostPerOrder: Number(cfg.courier_cost_per_order) || 50, metrics: null, daily: [], campaigns: [], adsets: [], ads: [], audiences: [], regions: [], placements: [], warnings: [] };
      }
      const base = `https://graph.facebook.com/v23.0/act_${encodeURIComponent(id)}`;
      const auth = `access_token=${encodeURIComponent(token)}`;
      const since = dhakaDate(data.from);
      const until = dhakaDate(data.to);
      const warnings: string[] = [];
      const safe = async (label: string, task: Promise<any>) => {
        try { return await task; }
        catch (error) { warnings.push(`${label}: ${error instanceof Error ? error.message : "API error"}`); return null; }
      };
      const accountJson = await graphGet(`${base}?fields=name,account_id,currency,account_status&${auth}`);
      const [summaryRaw, dailyRaw, campaignRaw, adsetRaw, adRaw, audienceRaw, regionRaw, placementRaw] = await Promise.all([
        safe("Account summary", insights(base, auth, since, until, "account")),
        safe("Daily trend", insights(base, auth, since, until, "account", "time_increment=1")),
        safe("Campaigns", insights(base, auth, since, until, "campaign")),
        safe("Ad Sets", insights(base, auth, since, until, "adset")),
        safe("Ads", insights(base, auth, since, until, "ad")),
        safe("Age/Gender", insights(base, auth, since, until, "account", "breakdowns=age,gender")),
        safe("Region", insights(base, auth, since, until, "account", "breakdowns=region")),
        safe("Placements", insights(base, auth, since, until, "account", "breakdowns=publisher_platform,platform_position")),
      ]);
      const account = {
        accountKey: key,
        accountName: String(accountJson.name || accountName),
        connected: true,
        currency: String(accountJson.currency || "USD"),
        accountStatus: Number(accountJson.account_status || 0),
        accountId: String(accountJson.account_id || id),
        dollarRate: Number(cfg.dollar_rate) || 122,
        courierCostPerOrder: Number(cfg.courier_cost_per_order) || 50,
        warnings,
      };
      const convert = (rows: any[] | null) => (rows ?? []).map((item) => normalizeInsight(item, account));
      const daily = convert(dailyRaw).map((item) => ({ ...item, day: item.date_start }));
      const campaigns = convert(campaignRaw);
      const adsets = convert(adsetRaw);
      const ads = convert(adRaw);
      const audiences = convert(audienceRaw);
      const regions = convert(regionRaw);
      const placements = convert(placementRaw);
      const summary = convert(summaryRaw)?.[0] ?? normalizeInsight({}, account);
      const spend = summary.spend;
      const purchases = summary.purchases;
      const purchaseValue = summary.purchaseValue;
      return {
        ...account,
        metrics: {
          spend, spendUsd: spend * (account.currency === "BDT" ? 1 / account.dollarRate : 1), purchases, purchaseValue,
          cpa: purchases > 0 ? spend / purchases : null,
          cpaUsd: purchases > 0 ? (spend * (account.currency === "BDT" ? 1 / account.dollarRate : 1)) / purchases : null,
          cpcUsd: Number(summary.cpc || 0) * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
          cpmUsd: Number(summary.cpm || 0) * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
          roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
          impressions: summary.impressions,
          reach: summary.reach,
          clicks: summary.clicks,
          ctr: summary.ctr,
          cpc: summary.cpc,
          cpm: summary.cpm,
          frequency: summary.frequency,
          linkClicks: summary.linkClicks,
          landingPageViews: summary.landingPageViews,
          addToCarts: summary.addToCarts,
          checkouts: summary.checkouts,
        },
        daily, campaigns, adsets, ads, audiences, regions, placements,
      };
    }));

    const from = new Date(data.from).toISOString();
    const to = new Date(data.to).toISOString();
    const { data: orderRows, error: ordersError } = await db
      .from("orders")
      .select("id,status,total,subtotal,delivery_fee,discount,created_at,source,order_items(quantity,subtotal,product_id,products(cost))")
      .gte("created_at", from).lte("created_at", to)
      .order("created_at", { ascending: false }).limit(10000);
    if (ordersError) throw new Error(`Site order report: ${ordersError.message}`);

    const orderStats = {
      total: (orderRows ?? []).length, delivered: 0, active: 0, cancelled: 0, returned: 0,
      deliveredRevenue: 0, activeOrderValue: 0, productCost: 0, missingCostLines: 0, missingCostOrders: 0,
      deliveredCourierEstimate: 0, deliveredContributionBeforeAds: 0,
      sourceBreakdown: [] as Array<{ source: string; orders: number; revenue: number }>,
    };
    const sourceTotals = new Map<string, { source: string; orders: number; revenue: number }>();
    for (const order of orderRows ?? []) {
      const status = String(order.status || "").toLowerCase();
      const isDelivered = status === "delivered";
      const isCancelled = ["cancelled", "canceled"].includes(status);
      const isReturned = ["returned", "partial"].includes(status);
      const isActive = ["web_pending", "processing", "pending", "rts", "shipped", "pending_return"].includes(status);
      const total = Number(order.total || 0);
      if (isDelivered) {
        orderStats.delivered++;
        orderStats.deliveredRevenue += total;
        const source = String(order.source || "unknown");
        const current = sourceTotals.get(source) || { source, orders: 0, revenue: 0 };
        current.orders++;
        current.revenue += total;
        sourceTotals.set(source, current);
      }
      if (isActive) { orderStats.active++; orderStats.activeOrderValue += total; }
      if (isCancelled) orderStats.cancelled++;
      if (isReturned) orderStats.returned++;
      if (isDelivered) {
        let cost = 0;
        let hasMissingCost = false;
        for (const item of order.order_items ?? []) {
          const unitCost = Number(item?.products?.cost);
          if (Number.isFinite(unitCost) && unitCost > 0) cost += unitCost * Number(item.quantity || 0);
          else if (Number(item.quantity || 0) > 0) {
            orderStats.missingCostLines++;
            hasMissingCost = true;
          }
        }
        if (hasMissingCost) orderStats.missingCostOrders++;
        orderStats.productCost += cost;
      }
    }
    const connectedAccounts = accounts.filter((account: any) => account.connected);
    const primaryConfig = ((integrations ?? []).find((item: any) => item.name === "meta_ad_account")?.config ?? {}) as Config;
    const courierCost = Number(primaryConfig.courier_cost_per_order) || 50;
    orderStats.sourceBreakdown = Array.from(sourceTotals.values()).sort((a, b) => b.revenue - a.revenue);
    orderStats.deliveredCourierEstimate = orderStats.delivered * courierCost;
    orderStats.deliveredContributionBeforeAds = orderStats.deliveredRevenue - orderStats.productCost - orderStats.deliveredCourierEstimate;

    const combined = connectedAccounts.reduce((sum: any, account: any) => {
      const m = account.metrics || {};
      const factor = account.currency === "BDT" ? 1 : account.dollarRate;
      sum.spend += Number(m.spend || 0);
      sum.spendBdt += Number(m.spend || 0) * factor;
      sum.spendUsd += Number(m.spend || 0) * (account.currency === "BDT" ? 1 / account.dollarRate : 1);
      sum.purchases += Number(m.purchases || 0);
      sum.purchaseValue += Number(m.purchaseValue || 0);
      sum.purchaseValueBdt += Number(m.purchaseValue || 0) * factor;
      sum.impressions += Number(m.impressions || 0);
      sum.reach += Number(m.reach || 0);
      sum.clicks += Number(m.clicks || 0);
      sum.linkClicks += Number(m.linkClicks || 0);
      sum.landingPageViews += Number(m.landingPageViews || 0);
      sum.addToCarts += Number(m.addToCarts || 0);
      sum.checkouts += Number(m.checkouts || 0);
      return sum;
    }, { spend: 0, spendBdt: 0, spendUsd: 0, purchases: 0, purchaseValue: 0, purchaseValueBdt: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, landingPageViews: 0, addToCarts: 0, checkouts: 0 });

    const flatten = (field: "daily" | "campaigns" | "adsets" | "ads" | "audiences" | "regions" | "placements") =>
      connectedAccounts.flatMap((account: any) => (account[field] ?? []).map((row: any) => ({
        ...row,
        spendBdt: row.spend * (account.currency === "BDT" ? 1 : account.dollarRate),
        cpaBdt: row.cpa == null ? null : row.cpa * (account.currency === "BDT" ? 1 : account.dollarRate),
        spendUsd: row.spend * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
        cpaUsd: row.cpa == null ? null : row.cpa * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
        cpcUsd: row.cpc * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
        cpmUsd: row.cpm * (account.currency === "BDT" ? 1 / account.dollarRate : 1),
      })));

    return {
      connected: connectedAccounts.length > 0,
      range: { since: dhakaDate(data.from), until: dhakaDate(data.to) },
      accounts: accounts.map(({ accountKey, accountName, connected, error, currency, accountStatus, accountId, warnings }: any) =>
        ({ accountKey, accountName, connected, error, currency, accountStatus, accountId, warnings })),
      metrics: {
        ...combined,
        cpa: combined.purchases > 0 ? combined.spendBdt / combined.purchases : null,
        cpaUsd: combined.purchases > 0 ? combined.spendUsd / combined.purchases : null,
        cpcUsd: combined.clicks > 0 ? combined.spendUsd / combined.clicks : 0,
        cpmUsd: combined.impressions > 0 ? combined.spendUsd / combined.impressions * 1000 : 0,
        roas: combined.spendBdt > 0 && combined.purchaseValueBdt > 0 ? combined.purchaseValueBdt / combined.spendBdt : null,
        ctr: combined.impressions > 0 ? combined.clicks / combined.impressions * 100 : 0,
        cpc: combined.clicks > 0 ? combined.spendBdt / combined.clicks : 0,
        reach: combined.reach,
        frequency: combined.reach > 0 ? combined.impressions / combined.reach : 0,
        cpm: combined.impressions > 0 ? combined.spendBdt / combined.impressions * 1000 : 0,
      },
      daily: flatten("daily").sort((a: any, b: any) => String(a.day).localeCompare(String(b.day))),
      campaigns: flatten("campaigns").sort((a: any, b: any) => b.spend - a.spend),
      adsets: flatten("adsets").sort((a: any, b: any) => b.spend - a.spend),
      ads: flatten("ads").sort((a: any, b: any) => b.spend - a.spend),
      audiences: flatten("audiences").sort((a: any, b: any) => b.spend - a.spend),
      regions: flatten("regions").sort((a: any, b: any) => b.spend - a.spend),
      placements: flatten("placements").sort((a: any, b: any) => b.spend - a.spend),
      orders: orderStats,
      fetchedAt: new Date().toISOString(),
      dataNotes: [
        "Meta purchase, purchase value ও ROAS হলো Meta attribution-এর রিপোর্ট; এগুলো সাইটের delivered order-এর সমান নয়।",
        "সাইটের delivered order সব source মিলিয়ে গণনা করা হয়েছে; প্রতিটি অর্ডারের campaign/ad attribution সংরক্ষিত না থাকলে campaign-wise প্রকৃত লাভ নিশ্চিত করা যায় না।",
        "Delivered contribution-এ product cost ও configured courier cost estimate বাদ দেওয়া হয়েছে; অন্যান্য overhead, staff cost, payment fee ও tax অন্তর্ভুক্ত নয়।",
        "Age/region/placement recommendation কেবল পর্যাপ্ত spend ও purchase sample থাকলে দেওয়া হয়; এগুলো test করার পরামর্শ, স্বয়ংক্রিয় targeting change নয়।",
      ],
    };
  });
