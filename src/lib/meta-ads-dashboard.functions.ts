import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
type MetaConfig = { access_token?: string; ad_account_id?: string; account_name?: string; account_id?: string };

const dhakaDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));

export const getMetaAdsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = supabaseAdmin as SupabaseClient<Database>;
    const { data: role, error: roleError } = await db.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "super_admin", "employee"]).maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Unauthorized");

    const { data: integration, error } = await db.from("integrations").select("config,is_active").eq("name", "meta_ad_account").maybeSingle();
    if (error) throw new Error(error.message);
    const cfg = ((integration?.config ?? {}) as MetaConfig);
    if (!integration?.is_active || !cfg.access_token || !cfg.ad_account_id) return { connected: false, error: "Meta Ad Account is not connected" };

    const accountId = cfg.ad_account_id.replace(/^act_/, "");
    const token = cfg.access_token.trim();
    const version = "v23.0";
    const base = `https://graph.facebook.com/${version}/act_${encodeURIComponent(accountId)}`;
    const auth = `access_token=${encodeURIComponent(token)}`;
    const since = dhakaDate(data.from);
    const until = dhakaDate(data.to);
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

    const accountUrl = `${base}?fields=name,account_id,spend_cap,amount_spent,currency,account_status&${auth}`;
    const insightsUrl = `${base}/insights?fields=spend,actions,cost_per_action_type&time_range=${timeRange}&level=account&${auth}`;
    const [accountRes, insightsRes] = await Promise.all([fetch(accountUrl), fetch(insightsUrl)]);
    const accountJson = await accountRes.json();
    const insightsJson = await insightsRes.json();
    if (!accountRes.ok || accountJson?.error) throw new Error(accountJson?.error?.message || "Meta account request failed");
    if (!insightsRes.ok || insightsJson?.error) throw new Error(insightsJson?.error?.message || "Meta insights request failed");

    const insight = insightsJson?.data?.[0] ?? {};
    const actions = Array.isArray(insight.actions) ? insight.actions : [];
    const costs = Array.isArray(insight.cost_per_action_type) ? insight.cost_per_action_type : [];

    // Meta may expose the same conversion through several action types.
    // Pick one canonical purchase metric instead of summing duplicate representations.
    const purchaseActionPriority = [
      "offsite_conversion.fb_pixel_purchase",
      "onsite_web_purchase",
      "onsite_conversion.purchase",
      "purchase",
      "omni_purchase",
      "web_in_store_purchase",
    ];
    const findPurchase = (items: any[]) => {
      for (const type of purchaseActionPriority) {
        const item = items.find((a: any) => String(a?.action_type) === type);
        if (item) return item;
      }
      return null;
    };

    const purchaseAction = findPurchase(actions);
    const purchaseCost = findPurchase(costs);
    const purchases = purchaseAction ? Number(purchaseAction.value || 0) : 0;
    const spend = Number(insight.spend || 0);
    const costPerPurchase = purchaseCost ? Number(purchaseCost.value || 0) : purchases > 0 ? spend / purchases : 0;

    const amountSpent = Number(accountJson.amount_spent || 0) / 100;
    const spendCapRaw = Number(accountJson.spend_cap);
    const spendingCap = Number.isFinite(spendCapRaw) && spendCapRaw > 0 ? spendCapRaw / 100 : null;
    const remainingLimit = spendingCap == null ? null : Math.max(0, spendingCap - amountSpent);

    return {
      connected: true,
      accountName: accountJson.name || cfg.account_name || "Meta Ad Account",
      accountId: accountJson.account_id || accountId,
      currency: accountJson.currency || "BDT",
      spend,
      purchases,
      costPerPurchase,
      spendingLimit: remainingLimit,
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