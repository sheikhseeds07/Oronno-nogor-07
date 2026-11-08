import { createServerFn } from "@tanstack/react-start";
import { assertIsAdmin } from "@/lib/_admin-guard.server";
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

    try {
      await assertIsAdmin(context.userId);
    } catch {
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
    await assertIsAdmin(context.userId).catch(() => { throw new Error("Forbidden"); });

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

const ManageRange = z.object({accountKey:z.enum(["meta_ad_account","meta_ad_account_2"]),from:z.string().datetime(),to:z.string().datetime()});
const ManageAction = z.object({accountKey:z.enum(["meta_ad_account","meta_ad_account_2"]),targetType:z.enum(["campaign","adset","ad"]).default("ad"),targetId:z.string().min(1).max(80),action:z.enum(["ACTIVE","PAUSED"])});
async function manageAccount(context:any,key:"meta_ad_account"|"meta_ad_account_2"){
 const db=context.supabase as any;
 await assertIsAdmin(context.userId).catch(() => { throw new Error("Admin access required"); });
 const {data:row,error}=await db.from("integrations").select("name,config,is_active").eq("name",key).maybeSingle();
 if(error) throw new Error(error.message);
 const cfg=(row?.config??{}) as MetaConfig, token=String(cfg.access_token??"").trim(), accountId=String(cfg.ad_account_id??cfg.account_id??"").replace(/^act_/,"").trim();
 if(!row?.is_active||!token||!accountId) throw new Error("Selected Meta Ad Account is not connected");
 return {db,cfg,token,accountId};
}
const purchaseMetrics=(ins:any)=>{
 const p=findPurchase(Array.isArray(ins?.actions)?ins.actions:[]);
 const c=findPurchase(Array.isArray(ins?.cost_per_action_type)?ins.cost_per_action_type:[]);
 const purchases=Number(p?.value||0), spend=Number(ins?.spend||0);
 return {purchases,spend,costPerPurchase:c?Number(c.value||0):(purchases?spend/purchases:0)};
};
async function verifyAdInAccount(adId:string,token:string,accountId:string){
 const ad=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(adId)}?fields=id,name,account_id&access_token=${encodeURIComponent(token)}`);
 if(String(ad.account_id??"")!==accountId) throw new Error("This Ad does not belong to the selected Ad Account");
 return ad;
}
async function changeAdStatus(adId:string,token:string,action:"ACTIVE"|"PAUSED"){
 const body=new URLSearchParams({status:action,access_token:token});
 const r=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(adId)}`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(12000)});
 const p=await r.json().catch(()=>({}));
 if(!r.ok||p?.error||p?.success!==true) throw new Error(p?.error?.message||`Meta API failed (${r.status})`);
}
export const getMetaAdInventory=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageRange.parse(i)).handler(async({data,context})=>{
 const {token,accountId,cfg}=await manageAccount(context,data.accountKey);
 const since=dhakaDate(data.from),until=dhakaDate(data.to),base=`https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}`;
 const params=new URLSearchParams({fields:"id,name,status,effective_status,creative{thumbnail_url,image_url}",limit:"500",access_token:token});
 let next:string|null=`${base}/ads?${params}`,ads:any[]=[],pages=0;
 while(next&&pages<100){const u=new URL(next);if(u.hostname!=="graph.facebook.com"||u.protocol!=="https:")throw new Error("Invalid Meta pagination URL");const p=await graphJson(u.toString());ads.push(...(p.data??[]));next=p.paging?.next??null;pages++;}
 const ip=new URLSearchParams({level:"ad",fields:"ad_id,spend,actions,cost_per_action_type",time_range:JSON.stringify({since,until}),limit:"500",access_token:token});
 const [insights,accountInfo]=await Promise.all([graphJson(`${base}/insights?${ip}`),graphJson(`${base}?fields=name,currency&access_token=${encodeURIComponent(token)}`)]), im=new Map((insights.data??[]).map((x:any)=>[String(x.ad_id),x]));
 const rows=ads.map((a:any)=>{const st=String(a.status??"UNKNOWN").toUpperCase(),es=String(a.effective_status??st).toUpperCase();return {id:String(a.id),name:String(a.name||"Unnamed Ad"),status:st,effectiveStatus:es,state:es==="ACTIVE"?"On":(["PAUSED","CAMPAIGN_PAUSED","ADSET_PAUSED","ARCHIVED","DELETED"].includes(es)||["PAUSED","ARCHIVED","DELETED"].includes(st))?"Off":"Other",imageUrl:String(a.creative?.thumbnail_url||a.creative?.image_url||""),...purchaseMetrics(im.get(String(a.id))??{})};});
 return {accountKey:data.accountKey,accountName:String((cfg as any).demo_name||cfg.account_name||(data.accountKey==="meta_ad_account_2"?"Oronno Nogor":"Sheikh Seeds")),currency:String(accountInfo.currency||"USD"),since,until,total:rows.length,onCount:rows.filter(x=>x.state==="On").length,offCount:rows.filter(x=>x.state==="Off").length,otherCount:rows.filter(x=>x.state==="Other").length,truncated:!!next,ads:rows};
});
export const getMetaAdDetails=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageRange.extend({adId:z.string().min(1).max(80)}).parse(i)).handler(async({data,context})=>{
 const {token,accountId}=await manageAccount(context,data.accountKey);
 const ad=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.adId)}?fields=id,name,account_id,status,effective_status,creative{thumbnail_url,image_url}&access_token=${encodeURIComponent(token)}`);
 if(String(ad.account_id??"")!==accountId)throw new Error("This Ad does not belong to the selected account");
 const since=dhakaDate(data.from),until=dhakaDate(data.to),tr=encodeURIComponent(JSON.stringify({since,until}));
 const ins=await graphJson(`https://graph.facebook.com/v23.0/${data.adId}/insights?fields=spend,actions,cost_per_action_type&time_range=${tr}&access_token=${encodeURIComponent(token)}`);
 return {id:String(ad.id),name:String(ad.name||""),status:String(ad.status||""),effectiveStatus:String(ad.effective_status||""),imageUrl:String(ad.creative?.thumbnail_url||ad.creative?.image_url||""),...purchaseMetrics(ins.data?.[0]??{}),since,until};
});
export const setMetaAdStatus=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageAction.parse(i)).handler(async({data,context})=>{
 const {token,accountId}=await manageAccount(context,data.accountKey);const target=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.targetId)}?fields=id,account_id&access_token=${encodeURIComponent(token)}`);if(String(target.account_id??"")!==accountId)throw new Error("Selected object does not belong to this Ad Account");await changeAdStatus(data.targetId,token,data.action);return {success:true,action:data.action,targetType:data.targetType};
});
export const scheduleMetaAdStatus=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageAction.extend({targetName:z.string().max(300).default(""),runAt:z.string().datetime()}).parse(i)).handler(async({data,context})=>{
 const {db,token,accountId}=await manageAccount(context,data.accountKey);const target=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.targetId)}?fields=id,name,account_id&access_token=${encodeURIComponent(token)}`);if(String(target.account_id??"")!==accountId)throw new Error("Selected object does not belong to this Ad Account");
 if(new Date(data.runAt).getTime()<Date.now()+60000)throw new Error("কমপক্ষে ১ মিনিট পরের সময় নির্বাচন করুন");
 const {data:row,error}=await db.from("meta_ad_schedules").insert({account_key:data.accountKey,ad_id:data.targetId,target_id:data.targetId,target_type:data.targetType,ad_name:data.targetName||String(target.name||""),action:data.action,run_at:data.runAt,created_by:context.userId}).select("id,account_key,ad_id,target_id,target_type,ad_name,action,run_at,status").single();
 if(error)throw new Error(error.message);return row;
});
export const getMetaAdSchedules=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({accountKey:z.enum(["meta_ad_account","meta_ad_account_2"])}).parse(i)).handler(async({data,context})=>{
 const {db}=await manageAccount(context,data.accountKey);const {data:rows,error}=await db.from("meta_ad_schedules").select("id,ad_id,target_id,target_type,ad_name,action,run_at,status,error_text").eq("account_key",data.accountKey).eq("status","pending").order("run_at",{ascending:false}).limit(30);if(error)throw new Error(error.message);return rows??[];
});
export const cancelMetaAdSchedule=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({id:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const db=context.supabase as any;await assertIsAdmin(context.userId).catch(()=>{throw new Error("Forbidden")});
 const {data:row,error}=await db.from("meta_ad_schedules").update({status:"cancelled"}).eq("id",data.id).eq("status","pending").select("id").maybeSingle();if(error)throw new Error(error.message);return {success:!!row};
});


/** Campaign-first hierarchy for Manage Ads: campaigns -> ad sets -> ads. */
export const getMetaCampaignInventory=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageRange.parse(i)).handler(async({data,context})=>{
 const {token,accountId,cfg}=await manageAccount(context,data.accountKey);
 const since=dhakaDate(data.from),until=dhakaDate(data.to),base=`https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}`;
 const params=new URLSearchParams({fields:"id,name,status,effective_status,objective,daily_budget,ads.limit(1){creative{thumbnail_url,image_url}}",limit:"500",access_token:token});
 let next:string|null=`${base}/campaigns?${params}`,items:any[]=[],pages=0;
 while(next&&pages<100){const u=new URL(next);if(u.hostname!=="graph.facebook.com"||u.protocol!=="https:")throw new Error("Invalid Meta pagination URL");const p=await graphJson(u.toString());items.push(...(p.data??[]));next=p.paging?.next??null;pages++;}
 const ip=new URLSearchParams({level:"campaign",fields:"campaign_id,spend,actions,cost_per_action_type",time_range:JSON.stringify({since,until}),limit:"500",access_token:token});
 const [insights,accountInfo]=await Promise.all([graphJson(`${base}/insights?${ip}`),graphJson(`${base}?fields=name,currency&access_token=${encodeURIComponent(token)}`)]);
 const im=new Map((insights.data??[]).map((x:any)=>[String(x.campaign_id),x]));
 const campaigns=items.map((x:any)=>{const st=String(x.status??"UNKNOWN").toUpperCase(),es=String(x.effective_status??st).toUpperCase();return {id:String(x.id),name:String(x.name||"Unnamed Campaign"),status:st,effectiveStatus:es,state:es==="ACTIVE"?"On":(["PAUSED","ARCHIVED","DELETED"].includes(es)||["PAUSED","ARCHIVED","DELETED"].includes(st))?"Off":"Other",objective:String(x.objective||""),dailyBudget:x.daily_budget==null?0:Number(x.daily_budget)/100,imageUrl:String(x.ads?.data?.[0]?.creative?.thumbnail_url||x.ads?.data?.[0]?.creative?.image_url||""),...purchaseMetrics(im.get(String(x.id))??{})};});
 return {accountName:String((cfg as any).demo_name||cfg.account_name||"Meta Ad Account"),currency:String(accountInfo.currency||"USD"),since,until,total:campaigns.length,onCount:campaigns.filter(x=>x.state==="On").length,offCount:campaigns.filter(x=>x.state==="Off").length,otherCount:campaigns.filter(x=>x.state==="Other").length,truncated:!!next,campaigns};
});
export const getMetaCampaignAdsets=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageRange.extend({campaignId:z.string().min(1).max(80)}).parse(i)).handler(async({data,context})=>{
 const {token,accountId}=await manageAccount(context,data.accountKey);
 const campaign=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.campaignId)}?fields=id,account_id,name&access_token=${encodeURIComponent(token)}`);
 if(String(campaign.account_id??"")!==accountId)throw new Error("Campaign does not belong to selected Ad Account");
 const since=dhakaDate(data.from),until=dhakaDate(data.to);
 const p=new URLSearchParams({fields:"id,name,status,effective_status,daily_budget",limit:"500",access_token:token});
 const base=`https://graph.facebook.com/v23.0/${encodeURIComponent(data.campaignId)}/adsets`;
 let next:string|null=`${base}?${p}`,items:any[]=[],pages=0;
 while(next&&pages<100){const u=new URL(next);if(u.hostname!=="graph.facebook.com"||u.protocol!=="https:")throw new Error("Invalid Meta pagination URL");const r=await graphJson(u.toString());items.push(...(r.data??[]));next=r.paging?.next??null;pages++;}
 const ip=new URLSearchParams({level:"adset",fields:"adset_id,spend,actions,cost_per_action_type",time_range:JSON.stringify({since,until}),limit:"500",access_token:token});
 const insights=await graphJson(`https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}/insights?${ip}`);
 const im=new Map((insights.data??[]).map((x:any)=>[String(x.adset_id),x]));
 const adsets=items.map((x:any)=>{const st=String(x.status??"UNKNOWN").toUpperCase(),es=String(x.effective_status??st).toUpperCase();return {id:String(x.id),name:String(x.name||"Unnamed Ad Set"),status:st,effectiveStatus:es,state:es==="ACTIVE"?"On":(["PAUSED","CAMPAIGN_PAUSED","ARCHIVED","DELETED"].includes(es)||["PAUSED","ARCHIVED","DELETED"].includes(st))?"Off":"Other",dailyBudget:x.daily_budget==null?0:Number(x.daily_budget)/100,...purchaseMetrics(im.get(String(x.id))??{})};});
 return {campaignName:String(campaign.name||""),total:adsets.length,onCount:adsets.filter(x=>x.state==="On").length,offCount:adsets.filter(x=>x.state==="Off").length,adsets};
});
export const getMetaAdsetAds=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(i=>ManageRange.extend({adsetId:z.string().min(1).max(80)}).parse(i)).handler(async({data,context})=>{
 const {token,accountId}=await manageAccount(context,data.accountKey);
 const adset=await graphJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(data.adsetId)}?fields=id,account_id,name&access_token=${encodeURIComponent(token)}`);
 if(String(adset.account_id??"")!==accountId)throw new Error("Ad Set does not belong to selected Ad Account");
 const since=dhakaDate(data.from),until=dhakaDate(data.to);
 const p=new URLSearchParams({fields:"id,name,status,effective_status,creative{thumbnail_url,image_url}",limit:"500",access_token:token});
 const base=`https://graph.facebook.com/v23.0/${encodeURIComponent(data.adsetId)}/ads`;
 let next:string|null=`${base}?${p}`,items:any[]=[],pages=0;
 while(next&&pages<100){const u=new URL(next);if(u.hostname!=="graph.facebook.com"||u.protocol!=="https:")throw new Error("Invalid Meta pagination URL");const r=await graphJson(u.toString());items.push(...(r.data??[]));next=r.paging?.next??null;pages++;}
 const ip=new URLSearchParams({level:"ad",fields:"ad_id,spend,actions,cost_per_action_type",time_range:JSON.stringify({since,until}),limit:"500",access_token:token});
 const insights=await graphJson(`https://graph.facebook.com/v23.0/act_${encodeURIComponent(accountId)}/insights?${ip}`);
 const im=new Map((insights.data??[]).map((x:any)=>[String(x.ad_id),x]));
 const ads=items.map((x:any)=>{const st=String(x.status??"UNKNOWN").toUpperCase(),es=String(x.effective_status??st).toUpperCase();return {id:String(x.id),name:String(x.name||"Unnamed Ad"),status:st,effectiveStatus:es,state:es==="ACTIVE"?"On":(["PAUSED","CAMPAIGN_PAUSED","ADSET_PAUSED","ARCHIVED","DELETED"].includes(es)||["PAUSED","ARCHIVED","DELETED"].includes(st))?"Off":"Other",imageUrl:String(x.creative?.thumbnail_url||x.creative?.image_url||""),...purchaseMetrics(im.get(String(x.id))??{})};});
 return {adsetName:String(adset.name||""),total:ads.length,onCount:ads.filter(x=>x.state==="On").length,offCount:ads.filter(x=>x.state==="Off").length,ads};
});
