import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/personal-supabase/auth-middleware";
import { supabaseAdmin } from "@/lib/personal-supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const RangeSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

type MetaConfig = {
  access_token?: string;
  ad_account_id?: string;
  account_name?: string;
  account_id?: string;
};

const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export const getMetaAdsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = supabaseAdmin as SupabaseClient<Database>;
    const { data: role, error: roleError } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin", "employee"])
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Unauthorized");

    const { data: integration, error } = await db
      .from("integrations")
      .select("config,is_active")
      .eq("name", "meta_ad_account")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const cfg = ((integration?.config ?? {}) as MetaConfig);
    if (!integration?.is_active || !cfg.access_token || !cfg.ad_account_id) {
      return { connected: false, error: "Meta Ad Account is not connected" };
    }

    const accountId = cfg.ad_account_id.replace(/^act_/, "");
    const token = cfg.access_token.trim();
    const version = "v23.0";
    const base = `https://graph.facebook.com/${version}/act_${encodeURIComponent(accountId)}`;
    const auth = `access_token=${encodeURIComponent(token)}`;

    const accountUrl = `${base}?fields=name,account_id,spend_cap,amount_spent,currency,account_status&${auth}`;
    const since = dateOnly(data.from);
    const until = dateOnly(data.to);
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
    const insightsUrl = `${base}/insights?fields=spend,actions,cost_per_action_type&time_range=${timeRange}&level=account&${auth}`;

    const [accountRes, insightsRes] = await Promise.all([fetch(accountUrl), fetch(insightsUrl)]);
    const accountJson = await accountRes.json();
    const insightsJson = await insightsRes.json();
    if (!accountRes.ok || accountJson?.error) throw new Error(accountJson?.error?.message || "Meta account request failed");
    if (!insightsRes.ok || insightsJson?.error) throw new Error(insightsJson?.error?.message || "Meta insights request failed");

    const insight = insightsJson?.data?.[0] ?? {};
    const actions = Array.isArray(insight.actions) ? insight.actions : [];
    const costs = Array.isArray(insight.cost_per_action_type) ? insight.cost_per_action_type : [];
    const purchaseTypes = new Set([
      "purchase",
      "omni_purchase",
      "offsite_conversion.fb_pixel_purchase",
      "onsite_conversion.purchase",
      "onsite_web_purchase",
      "web_in_store_purchase",
    ]);
    const purchases = actions
      .filter((a: any) => purchaseTypes.has(String(a.action_type)))
      .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0);
    const purchaseCost = costs.find((a: any) => purchaseTypes.has(String(a.action_type)));
    const spend = Number(insight.spend || 0);
    const costPerPurchase = purchaseCost ? Number(purchaseCost.value || 0) : purchases > 0 ? spend / purchases : 0;
    const spendCapRaw = Number(accountJson.spend_cap);

    return {
      connected: true,
      accountName: accountJson.name || cfg.account_name || "Meta Ad Account",
      accountId: accountJson.account_id || accountId,
      currency: accountJson.currency || "BDT",
      spend,
      purchases,
      costPerPurchase,
      spendingLimit: Number.isFinite(spendCapRaw) && spendCapRaw > 0 ? spendCapRaw / 100 : null,
      accountAmountSpent: Number(accountJson.amount_spent || 0) / 100,
      accountStatus: accountJson.account_status,
      since,
      until,
    };
  });
