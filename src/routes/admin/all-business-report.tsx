import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, ShoppingBag, RotateCcw, Truck, DollarSign, Package, Megaphone, Activity, ArrowLeft, RefreshCw, WalletCards } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/all-business-report")({ component: AllBusinessReport });
type OrderRow = Record<string, unknown>;
type CostMap = Record<string, number>;
const money = (n: number) => `৳${Math.round(n).toLocaleString("en-BD")}`;
function getOrderCost(order: OrderRow, costs: CostMap) {
  const rawItems = order.items ?? order.order_items ?? order.line_items ?? order.products;
  if (!Array.isArray(rawItems)) return 0;
  return rawItems.reduce((sum, item: any) => {
    const key = String(item?.product_id ?? item?.productId ?? item?.id ?? item?.name ?? "");
    const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
    return sum + (costs[key] ?? costs[String(item?.name ?? "")] ?? 0) * qty;
  }, 0);
}
function AllBusinessReport() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<OrderRow[]>([]);
  const [costs, setCosts] = useState<CostMap>(() => { try { return JSON.parse(localStorage.getItem("abr-product-costs") || "{}"); } catch { return {}; } });
  const [dollarRate, setDollarRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "ads">("overview");
  const load = async () => {
    setLoading(true);
    const [o, p, i] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(10000),
      supabase.from("products").select("*").limit(1000),
      supabase.from("integrations").select("config").eq("key", "meta_ad_account").maybeSingle(),
    ]);
    if (o.error) toast.error(`Orders: ${o.error.message}`);
    if (p.error) toast.error(`Products: ${p.error.message}`);
    setOrders((o.data ?? []) as OrderRow[]); setProducts((p.data ?? []) as OrderRow[]);
    const config = (i.data?.config ?? {}) as Record<string, unknown>;
    setDollarRate(Number(config.dollarRate) || 0);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const stats = useMemo(() => {
    const delivered = orders.filter(o => String(o.status) === "delivered");
    const returned = orders.filter(o => ["returned", "pending_return", "rts"].includes(String(o.status)));
    const cancelled = orders.filter(o => String(o.status) === "cancelled");
    const revenue = delivered.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const productCost = delivered.reduce((s, o) => s + getOrderCost(o, costs), 0);
    const deliveryCost = delivered.reduce((s, o) => s + Number(o.courier_cost ?? o.delivery_cost ?? o.shipping_cost ?? 0), 0);
    const returnCost = returned.reduce((s, o) => s + Number(o.courier_cost ?? o.delivery_cost ?? o.shipping_cost ?? 0), 0);
    const adSpendUsd = orders.reduce((s, o) => s + Number(o.ad_spend ?? 0), 0);
    const adSpendBdt = dollarRate > 0 ? adSpendUsd * dollarRate : 0;
    const profit = revenue - productCost - deliveryCost - returnCost - adSpendBdt;
    const deliveryRate = orders.length ? (delivered.length / orders.length) * 100 : 0;
    return { total: orders.length, delivered: delivered.length, returned: returned.length, cancelled: cancelled.length, revenue, productCost, deliveryCost, returnCost, adSpendUsd, adSpendBdt, profit, deliveryRate };
  }, [orders, costs, dollarRate]);
  const saveCost = (key: string, value: string) => { const next = { ...costs, [key]: Number(value) || 0 }; setCosts(next); localStorage.setItem("abr-product-costs", JSON.stringify(next)); };
  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">ABR — All Business Report</h1></div><p className="mt-1 text-sm text-muted-foreground">রিয়েল অর্ডার, খরচ, লাভ-ক্ষতি ও Meta Ads খরচের এক জায়গার রিপোর্ট</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><button onClick={() => setTab("overview")} className={`group rounded-2xl border p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${tab === "overview" ? "border-primary bg-primary/5" : "bg-card"}`}><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><WalletCards className="h-6 w-6" /></div><div><div className="font-semibold">১. বিজনেস ওভারভিউ</div><div className="text-sm text-muted-foreground">অর্ডার, পণ্য কস্ট, কুরিয়ার, রিটার্ন লস ও লাভ</div></div></div></button><button onClick={() => setTab("ads")} className={`group rounded-2xl border p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${tab === "ads" ? "border-primary bg-primary/5" : "bg-card"}`}><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-500/10 p-3"><Megaphone className="h-6 w-6" /></div><div><div className="font-semibold">২. এড রেজাল্ট</div><div className="text-sm text-muted-foreground">Meta Ad Account-এর spend, CPA ও ads status</div></div></div></button></div>
    {tab === "overview" ? <><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={ShoppingBag} label="মোট অর্ডার" value={stats.total.toLocaleString("en-BD")} /><Metric icon={TrendingUp} label="ডেলিভার্ড" value={stats.delivered.toLocaleString("en-BD")} /><Metric icon={Truck} label="ডেলিভারি রেট" value={`${stats.deliveryRate.toFixed(1)}%`} /><Metric icon={RotateCcw} label="রিটার্ন / RTS" value={stats.returned.toLocaleString("en-BD")} /></div><div className="grid gap-4 md:grid-cols-3"><FinanceCard label="ডেলিভার্ড সেলস" value={money(stats.revenue)} icon={DollarSign} /><FinanceCard label="প্রোডাক্ট কস্ট" value={money(stats.productCost)} icon={Package} /><FinanceCard label="কুরিয়ার কস্ট" value={money(stats.deliveryCost)} icon={Truck} /><FinanceCard label="রিটার্ন/ডেলিভারি লস" value={money(stats.returnCost)} icon={RotateCcw} /><FinanceCard label={`এড স্পেন্ড${dollarRate ? ` @ ৳${dollarRate}/$` : ""}`} value={dollarRate ? `${money(stats.adSpendBdt)} (${stats.adSpendUsd.toFixed(2)} USD)` : "Dollar Rate সেট করুন"} icon={Megaphone} /><FinanceCard label="নেট অপারেটিং লাভ" value={money(stats.profit)} icon={stats.profit >= 0 ? TrendingUp : TrendingDown} highlight={stats.profit >= 0} /></div><div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">প্রোডাক্ট কস্ট সেটআপ</h2><p className="text-xs text-muted-foreground">প্রতি পণ্যের ইউনিট কস্ট দিলে লাভের হিসাব আরও নির্ভুল হবে।</p></div><Package className="h-5 w-5 text-muted-foreground" /></div><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{products.map((p: any) => { const key = String(p.id ?? p.product_id ?? p.name ?? ""); return <div key={key} className="rounded-xl border p-3"><div className="mb-2 truncate text-sm font-medium">{p.name ?? p.title ?? "Product"}</div><div className="flex items-center gap-2"><input className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" type="number" min="0" step="0.01" value={costs[key] ?? ""} onChange={e => saveCost(key, e.target.value)} placeholder="কস্ট (৳)" /><span className="text-xs text-muted-foreground">/unit</span></div></div>; })}</div></div><div className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="mb-4 font-semibold">বিজনেস চার্ট</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Sales",money(stats.revenue)],["Product Cost",money(stats.productCost)],["Courier + Return",money(stats.deliveryCost+stats.returnCost)],["Ad Spend",dollarRate?money(stats.adSpendBdt):"—"]].map(([l,v])=><div key={String(l)} className="rounded-xl bg-muted/50 p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-2 text-lg font-bold">{v}</div></div>)}</div></div></> : <AdsReport />}
  </div></AdminLayout>;
}
function AdsReport() { const [loading,setLoading]=useState(false); const [account,setAccount]=useState<{name:string;id:string}|null>(null); const [ads,setAds]=useState<any[]>([]); const [summary,setSummary]=useState({spend:0,results:0,cpr:0}); const loadAds=async()=>{setLoading(true); const {data}=await supabase.from("integrations").select("config").eq("key","meta_ad_account").maybeSingle(); const c=(data?.config??{}) as Record<string,unknown>; const id=String(c.adAccountId??""); setAccount(id?{name:String(c.accountName??"Meta Ad Account"),id}:null); setAds([]); setSummary({spend:0,results:0,cpr:0}); setLoading(false);}; useEffect(()=>{void loadAds();},[]); return <div className="space-y-4"><div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-500/10 p-3"><Megaphone className="h-6 w-6 text-blue-600" /></div><div><h2 className="font-semibold">Meta Ad Account Overview</h2><p className="text-sm text-muted-foreground">Connected account-এর real data secure Graph API server function দিয়ে আনতে হবে।</p></div></div><div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 p-4"><div><div className="text-sm font-medium">{account?.name??"কোনো Meta account connected নেই"}</div><div className="text-xs text-muted-foreground">{account?.id??"Meta Ad Account → Connect করুন"}</div></div><button onClick={()=>void loadAds()} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`} /> Sync</button></div></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><FinanceCard label="Total Spend" value={summary.spend?`$${summary.spend.toFixed(2)}`:"—"} icon={DollarSign}/><FinanceCard label="Total Results" value={summary.results?summary.results.toLocaleString():"—"} icon={Activity}/><FinanceCard label="Average Cost / Result" value={summary.cpr?`$${summary.cpr.toFixed(2)}`:"—"} icon={TrendingUp}/></div><div className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="mb-4 font-semibold">All Ads — Live Status</h2>{ads.length?<div/>:<div className="flex min-h-40 flex-col items-center justify-center text-center text-muted-foreground"><Activity className="mb-2 h-8 w-8 opacity-50"/><p>Live ad data এখনো available নয়</p><p className="text-xs">Meta Graph API secure server connection complete হলে এখানে সব ads-এর status, spend, results ও cost/result আসবে।</p></div>}</div></div>; }
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"><Icon className="h-5 w-5 text-primary"/><div className="mt-3 text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>}
function FinanceCard({label,value,icon:Icon,highlight}:{label:string;value:string;icon:any;highlight?:boolean}){return <div className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${highlight?"bg-emerald-500/5":"bg-card"}`}><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className="h-5 w-5 text-primary"/></div><div className="mt-3 text-2xl font-bold">{value}</div></div>}
