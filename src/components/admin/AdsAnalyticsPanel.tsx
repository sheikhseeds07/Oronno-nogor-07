import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign, Clock3, Eye, MapPin, MousePointerClick, RefreshCw, ShieldAlert, ShoppingCart, Target, Users, Wallet } from "lucide-react";
import { getAdsAnalytics } from "@/lib/ads-analytics.functions";

type AccountKey = "all" | "meta_ad_account" | "meta_ad_account_2";
type Tab = "overview" | "campaigns" | "audience" | "regions" | "placements" | "profit";
type Row = Record<string, any>;
const money = (n: number, digits = 0) => `৳${Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
const number = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
const percent = (n: number) => `${Number(n || 0).toFixed(2)}%`;
const actionName = (row: Row) => row.ad_name || row.adset_name || row.campaign_name || row.region || [row.age, row.gender].filter(Boolean).join(" · ") || row.publisher_platform || "—";
const Metric = ({ title, value, sub, icon: Icon, tone = "blue" }: any) => {
  const tones: any = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">{title}</span><span className={`rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4"/></span></div><div className="mt-3 text-2xl font-black tracking-tight text-slate-900">{value}</div><div className="mt-1 text-[11px] text-slate-500">{sub}</div></div>;
};
const StatusPill = ({ label, good }: { label: string; good: boolean }) => <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${good ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{label}</span>;

function Table({ rows, columns, empty }: { rows: Row[]; columns: Array<{ key: string; label: string; render?: (row: Row) => React.ReactNode }>; empty: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{empty}</div>;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{columns.map(c => <th key={c.key} className="whitespace-nowrap px-3 py-3 font-bold">{c.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r,i)=><tr key={r.ad_id || r.adset_id || r.campaign_id || r.region || r.day || i} className="hover:bg-slate-50/80">{columns.map(c=><td key={c.key} className="whitespace-nowrap px-3 py-3 text-slate-700">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
}

function guidance(rows: Row[], baseline: number | null, label: string) {
  if (!baseline || baseline <= 0) return [];
  return rows.map(row => {
    const purchases = Number(row.purchases || 0), spend = Number(row.spendBdt ?? row.spend ?? 0), cpa = row.cpaBdt == null ? (purchases > 0 ? spend / purchases : null) : Number(row.cpaBdt);
    if (purchases >= 3 && cpa != null && cpa <= baseline * 0.8) return { title: label, name: `${actionName(row)} · ${row.accountName || ""}`, status: "বাজেট বাড়িয়ে পরীক্ষা", tone: "good", reason: `${purchases}টি Meta purchase; CPA account average-এর চেয়ে অন্তত ২০% কম। ধাপে ধাপে ১০–২০% budget test করো।` };
    if (purchases === 0 && spend >= baseline * 1.5) return { title: label, name: `${actionName(row)} · ${row.accountName || ""}`, status: "Pause candidate", tone: "warn", reason: `এখনো purchase নেই এবং খরচ average CPA-এর ১.৫ গুণ। Tracking ও landing page যাচাই করে pause/test সিদ্ধান্ত নাও।` };
    if (purchases >= 1) return { title: label, name: `${actionName(row)} · ${row.accountName || ""}`, status: "আরও ডেটা নাও", tone: "neutral", reason: `Purchase এসেছে, তবে বড় সিদ্ধান্তের জন্য আরও conversion data দরকার।` };
    return null;
  }).filter(Boolean).slice(0, 8) as any[];
}

export function AdsAnalyticsPanel() {
  const fetchAnalytics = useServerFn(getAdsAnalytics);
  const [accountKey, setAccountKey] = useState<AccountKey>("all");
  const [days, setDays] = useState("30");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = async () => {
    const id = ++request.current;
    setLoading(true); setError("");
    const to = new Date();
    const from = new Date(to.getTime() - Math.max(0, Number(days) - 1) * 86400000);
    try {
      const result = await fetchAnalytics({ data: { from: from.toISOString(), to: to.toISOString(), accountKey } });
      if (id === request.current) setData(result);
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : "রিপোর্ট লোড করা যায়নি");
    } finally { if (id === request.current) setLoading(false); }
  };

  useEffect(() => { void load(); return () => { request.current++; }; }, [accountKey, days]);

  const recommendations = useMemo(() => {
    if (!data?.metrics?.cpa) return [];
    return [
      ...guidance(data.campaigns || [], data.metrics.cpa, "Campaign").slice(0, 3),
      ...guidance(data.ads || [], data.metrics.cpa, "Ad").slice(0, 3),
      ...guidance(data.audiences || [], data.metrics.cpa, "Audience").slice(0, 2),
      ...guidance(data.regions || [], data.metrics.cpa, "Region").slice(0, 2),
      ...guidance(data.placements || [], data.metrics.cpa, "Placement").slice(0, 2),
    ].slice(0, 12);
  }, [data]);

  const m = data?.metrics || {};
  const accounts = data?.accounts || [];
  const spendBdt = Number(m.spendBdt || 0);
  const daily = (data?.daily || []).map((r: Row) => ({ ...r, label: String(r.day || "").slice(5), spendBdt: Number(r.spendBdt || 0) }));
  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "campaigns", label: "Campaign / Ad", icon: Target },
    { id: "audience", label: "Age & Gender", icon: Users },
    { id: "regions", label: "Region", icon: MapPin },
    { id: "placements", label: "Placement", icon: Eye },
    { id: "profit", label: "Profit & Orders", icon: CircleDollarSign },
  ];
  const metricCols = [
    { key: "name", label: "নাম", render: (r: Row) => <div><div className="font-bold text-slate-900">{actionName(r)}</div><div className="text-[10px] text-slate-400">{r.accountName}</div></div> },
    { key: "spend", label: "খরচ (৳)", render: (r: Row) => money(r.spendBdt) },
    { key: "purchases", label: "Purchase", render: (r: Row) => number(r.purchases) },
    { key: "cpa", label: "Cost / Purchase", render: (r: Row) => r.cpaBdt == null ? "—" : money(r.cpaBdt) },
    { key: "roas", label: "ROAS", render: (r: Row) => r.roas == null ? "—" : `${r.roas.toFixed(2)}x` },
    { key: "ctr", label: "CTR", render: (r: Row) => percent(r.ctr) },
    { key: "frequency", label: "Frequency", render: (r: Row) => number(r.frequency) },
  ];

  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-300"><BarChart3 className="h-4 w-4"/> Ads Intelligence</div><h2 className="mt-2 text-2xl font-black">Ads Analytics</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">দুইটি Meta Ad Account-এর পারফরম্যান্স, অডিয়েন্স, লোকেশন, বিজ্ঞাপন ও সাইটের অর্ডার এক জায়গায় বিশ্লেষণ করুন।</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Refresh</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <select value={accountKey} onChange={e=>setAccountKey(e.target.value as AccountKey)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"><option className="text-slate-900" value="all">সব Ad Account</option><option className="text-slate-900" value="meta_ad_account">Sheikh Seeds</option><option className="text-slate-900" value="meta_ad_account_2">Oronno Nogor</option></select>
        <select value={days} onChange={e=>setDays(e.target.value)} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none"><option className="text-slate-900" value="7">শেষ ৭ দিন</option><option className="text-slate-900" value="14">শেষ ১৪ দিন</option><option className="text-slate-900" value="30">শেষ ৩০ দিন</option><option className="text-slate-900" value="90">শেষ ৯০ দিন</option></select>
        <div className="flex items-center rounded-xl bg-white/10 px-3 py-2 text-xs text-slate-200">{data?.range?.since || "—"} → {data?.range?.until || "—"}</div>
      </div>
    </div>

    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><b>রিপোর্ট লোড হয়নি:</b> {error}</div>}
    {loading && <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin"/>Meta ও সাইটের রিপোর্ট আনা হচ্ছে…</div>}
    {!loading && data && <>
      <div className="grid gap-2 sm:grid-cols-2">{accounts.map((a:Row)=><div key={a.accountKey} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"><div className="min-w-0"><div className="truncate text-xs font-bold text-slate-800">{a.accountName}</div><div className="text-[10px] text-slate-500">{a.accountId ? `act_${a.accountId}` : a.error || "Not configured"}</div></div><StatusPill label={a.connected ? (a.accountStatus === 1 ? "Connected · Active" : `Connected · Status ${a.accountStatus}`) : "Not connected"} good={a.connected && a.accountStatus === 1}/></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Meta Ad Spend" value={money(spendBdt)} sub={`Account dollar rate অনুযায়ী BDT-তে রূপান্তরিত · ${accounts.filter((a: Row) => a.connected).length} account(s)`} icon={Wallet} tone="blue"/>
        <Metric title="Meta Purchases" value={number(m.purchases)} sub="Meta attribution · deduplication may differ from site orders" icon={ShoppingCart} tone="green"/>
        <Metric title="Cost per Purchase" value={m.cpa == null ? "—" : money(m.cpa)} sub="Meta-reported CPA, converted using account dollar rate" icon={Target} tone="violet"/>
        <Metric title="Meta Purchase ROAS" value={m.roas == null ? "—" : `${Number(m.roas).toFixed(2)}x`} sub="Purchase value ÷ Meta ad spend" icon={Activity} tone="amber"/>
        <Metric title="Purchase Conversion Value" value={money(m.purchaseValueBdt)} sub="Meta-attributed purchase value · converted to BDT" icon={CircleDollarSign} tone="green"/>
        <Metric title="Reach" value={number(m.reach)} sub="Combined account reach · overlap possible" icon={Users} tone="blue"/>
        <Metric title="Frequency" value={number(m.frequency)} sub="Impressions ÷ combined reach" icon={Eye} tone="violet"/>
        <Metric title="Impressions" value={number(m.impressions)} sub={`CTR ${percent(m.ctr)}`} icon={Eye} tone="blue"/>
        <Metric title="Clicks" value={number(m.clicks)} sub={m.clicks ? `Avg CPC ${money((m.spendBdt || 0) / m.clicks)}` : "No clicks"} icon={MousePointerClick} tone="violet"/>
        <Metric title="CPM" value={money(m.cpm, 2)} sub="প্রতি ১,০০০ impressions-এর খরচ" icon={BarChart3} tone="amber"/>
        <Metric title="Delivered Orders (Site)" value={number(data.orders?.delivered)} sub={`Revenue ${money(data.orders?.deliveredRevenue)} · all channels`} icon={CheckCircle2} tone="green"/>
        <Metric title="Cancelled / Returned" value={`${number(data.orders?.cancelled)} / ${number(data.orders?.returned)}`} sub={`${number(data.orders?.active)} active / processing orders`} icon={ShieldAlert} tone="rose"/>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5">{tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${tab===t.id?"bg-slate-900 text-white shadow":"text-slate-600 hover:bg-slate-100"}`}><t.icon className="h-3.5 w-3.5"/>{t.label}</button>)}</div>

      {tab==="overview"&&<div className="space-y-4"><div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-extrabold text-slate-900">Daily Ad Spend</h3><p className="text-[11px] text-slate-500">প্রতিদিনের Meta spend (৳)</p></div><span className="text-xs font-bold text-slate-500">{daily.length} days</span></div>{daily.length?<div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><defs><linearGradient id="adsSpendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={.28}/><stop offset="100%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip formatter={(v:any)=>money(Number(v))}/><Area type="monotone" dataKey="spendBdt" stroke="#0f766e" fill="url(#adsSpendFill)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>:<p className="py-12 text-center text-sm text-slate-500">এই সময়ের daily data পাওয়া যায়নি।</p>}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-extrabold text-slate-900">করণীয় / Optimization Signals</h3><p className="mt-1 text-[11px] text-slate-500">নিচের নিয়মগুলো heuristic; সিদ্ধান্তের আগে tracking ও sample যাচাই করুন।</p><div className="mt-3 space-y-2">{recommendations.length?recommendations.map((r:any,i)=><div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs text-slate-900">{r.name}</b><StatusPill label={r.status} good={r.tone==="good"}/></div><p className="mt-1 text-[11px] leading-5 text-slate-600">{r.reason}</p></div>):<div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">এখনও নির্ভরযোগ্য CPA baseline নেই। আরও Purchase data আসলে targeting suggestion তৈরি হবে।</div>}</div></section>
      </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><h3 className="font-extrabold text-slate-900">Conversion Funnel</h3><p className="text-[11px] text-slate-500">Meta event reporting · প্রতিটি ধাপে কতজন এগিয়েছে দেখুন</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[{label:"Link Clicks",value:m.linkClicks},{label:"Landing Page Views",value:m.landingPageViews},{label:"Add to Cart",value:m.addToCarts},{label:"Checkout",value:m.checkouts},{label:"Purchases",value:m.purchases}].map((stage:any,i:number,arr:any[])=>{const rate=i>0&&Number(arr[i-1].value)>0?Number(stage.value)/Number(arr[i-1].value)*100:null;return <div key={stage.label} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold text-slate-500">{stage.label}</div><div className="mt-1 text-xl font-black text-slate-900">{number(stage.value)}</div>{i>0&&<div className="mt-1 text-[10px] font-semibold text-slate-500">{rate==null?"—":`${rate.toFixed(1)}% from previous`}</div>}</div>})}</div><p className="mt-2 text-[10px] text-slate-400">Pixel/CAPI event reporting Meta-তে পাওয়া ডেটার ওপর নির্ভরশীল; event setup বা attribution gap থাকলে funnel অসম্পূর্ণ হতে পারে।</p></section>
      </div>}

      {tab==="campaigns"&&<div className="space-y-4"><div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-900">Campaign, Ad Set ও Ad-এর পারফরম্যান্স আলাদা করে দেখুন। কোনো segment-এ purchase না থাকলে সেটি সরাসরি খারাপ প্রমাণ করে না—খরচ ও conversion sample বিবেচনা করুন।</div><h3 className="font-extrabold text-slate-900">Campaigns</h3><Table rows={data.campaigns||[]} columns={metricCols} empty="Campaign data পাওয়া যায়নি।"/><h3 className="font-extrabold text-slate-900">Ad Sets</h3><Table rows={data.adsets||[]} columns={metricCols} empty="Ad Set data পাওয়া যায়নি।"/><h3 className="font-extrabold text-slate-900">Ads</h3><Table rows={data.ads||[]} columns={metricCols} empty="Ad data পাওয়া যায়নি।"/></div>}

      {tab==="audience"&&<div className="space-y-3"><div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-5 text-violet-900">Age ও Gender অনুযায়ী CPA তুলনা করুন। পর্যাপ্ত purchase না থাকলে নির্দিষ্ট বয়স বাদ দেওয়ার পরামর্শ দেওয়া হবে না।</div><Table rows={data.audiences||[]} columns={[{key:"audience",label:"Age / Gender",render:(r:Row)=><div><b>{[r.age,r.gender].filter(Boolean).join(" · ")||"—"}</b><div className="text-[10px] text-slate-400">{r.accountName}</div></div>},...metricCols.slice(1)]} empty="এই সময়ের Age/Gender breakdown পাওয়া যায়নি।"/></div>}

      {tab==="regions"&&<div className="space-y-3"><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">Meta Region breakdown-এ যে location label দেয় সেটিই দেখানো হচ্ছে। এটি সবসময় বাংলাদেশের জেলা-নাম নাও হতে পারে।</div><Table rows={data.regions||[]} columns={[{key:"region",label:"Region",render:(r:Row)=><div><b>{r.region||"—"}</b><div className="text-[10px] text-slate-400">{r.accountName}</div></div>},...metricCols.slice(1)]} empty="Region breakdown পাওয়া যায়নি।"/></div>}

      {tab==="placements"&&<div className="space-y-3"><div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Facebook / Instagram platform এবং Feed, Stories, Reels placement অনুযায়ী ফলাফল তুলনা করুন।</div><Table rows={data.placements||[]} columns={[{key:"placement",label:"Platform / Position",render:(r:Row)=><div><b>{[r.publisher_platform,r.platform_position].filter(Boolean).join(" · ")||"—"}</b><div className="text-[10px] text-slate-400">{r.accountName}</div></div>},...metricCols.slice(1)]} empty="Placement breakdown পাওয়া যায়নি।"/></div>}

      {tab==="profit"&&<div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><b>সতর্কতা:</b> নিচের Site P&L কেবল Delivered order ও পণ্যের সংরক্ষিত cost ব্যবহার করে। এটি Meta campaign-attributed profit নয়। Campaign-wise প্রকৃত লাভের জন্য order-এ campaign/click attribution সংরক্ষণ করতে হবে।</div>{Number(data.orders?.missingCostLines||0)>0&&<div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><b>Product cost অসম্পূর্ণ:</b> {number(data.orders?.missingCostOrders)}টি delivered order-এ অন্তত একটি item-এর product cost ফাঁকা বা ০ ({number(data.orders?.missingCostLines)}টি item line)। তাই Product Cost ও Contribution Before Ads প্রকৃত লাভের চেয়ে বেশি দেখাতে পারে। আগে Products-এ প্রতিটি পণ্যের cost পূরণ করুন।</div></div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Delivered Revenue" value={money(data.orders?.deliveredRevenue)} sub="সাইটের সব source মিলিয়ে" icon={ShoppingCart} tone="green"/><Metric title="Product Cost" value={money(data.orders?.productCost)} sub={`${number(data.orders?.missingCostLines)} cost-missing item line(s)`} icon={Wallet} tone="amber"/><Metric title="Courier Cost Estimate" value={money(data.orders?.deliveredCourierEstimate)} sub="Integration-এর প্রতি পার্সেল cost × delivered" icon={Activity} tone="blue"/><Metric title="Contribution Before Ads" value={money(data.orders?.deliveredContributionBeforeAds)} sub="Revenue − product cost − courier estimate" icon={CircleDollarSign} tone={data.orders?.deliveredContributionBeforeAds>=0?"green":"rose"}/></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="font-extrabold text-slate-900">Business health</h3><div className="mt-3 grid gap-2 sm:grid-cols-4">{[[ "Total Orders",data.orders?.total],["Delivered",data.orders?.delivered],["Processing / Active",data.orders?.active],["Cancelled",data.orders?.cancelled]].map(([k,v]:any)=><div key={k} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-semibold text-slate-500">{k}</div><div className="mt-1 text-xl font-black text-slate-900">{number(v)}</div></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-extrabold text-slate-900">Delivered Orders by Source</h3><Table rows={data.orders?.sourceBreakdown||[]} columns={[{key:"source",label:"Order Source",render:(r:Row)=><b>{r.source}</b>},{key:"orders",label:"Delivered Orders",render:(r:Row)=>number(r.orders)},{key:"revenue",label:"Delivered Revenue",render:(r:Row)=>money(r.revenue)}]} empty="এই সময়ের delivered order source data নেই।"/></div>
      </div>}
      {accounts.some((a:Row)=>a.warnings?.length>0)&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-bold text-amber-900"><AlertTriangle className="h-4 w-4"/>কিছু breakdown পাওয়া যায়নি</div>{accounts.flatMap((a:Row)=>a.warnings.map((w:string)=><p key={a.accountKey+w} className="mt-1 text-[11px] text-amber-800">{a.accountName}: {w}</p>))}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-[10px] leading-5 text-slate-500"><div className="flex items-center gap-2 font-bold text-slate-700"><Clock3 className="h-3.5 w-3.5"/> Data notes · Updated {new Date(data.fetchedAt).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"})}</div>{data.dataNotes.map((note:string,i:number)=><p key={i}>• {note}</p>)}</div>
    </>}
  </div>;
}
