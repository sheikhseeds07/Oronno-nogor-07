import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Clock3, Package, RefreshCw, ShoppingCart, TrendingUp, Users, XCircle, Sparkles, Target, LockKeyhole } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { taka, enDigits } from "@/lib/format";
import { supabase } from "@/lib/personal-supabase/client";
import { getOptimizedDashboardReport, getWebProcessingOrderCount, getEmployeeLiveProcessingCounts, getEmployeeMetricOrders, bulkUpdateEmployeeMetricOrders, getEmployeeMonthlyBonusProgress } from "@/lib/dashboard-optimized.functions";
import { DashboardTimeFilter, getDashboardPresetRange, type DashboardPreset, type DashboardRange } from "@/components/admin/DashboardTimeFilter";
import { MetaAdsResultCard } from "@/components/admin/MetaAdsResultCard";
import { toast } from "sonner";

function Card({title,value,hint,icon:Icon,tone}:{title:string;value:string;hint:string;icon:any;tone:string}){return <div className={`group relative isolate flex min-h-[156px] h-full min-w-0 flex-col overflow-hidden rounded-[22px] border bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] ${tone}`}><div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-slate-100/70 blur-2xl transition-transform duration-700 group-hover:scale-150"/><div className="relative flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100 transition-all duration-500 group-hover:rotate-6 group-hover:scale-110"><Icon className="h-5 w-5"/></div><Activity className="h-4 w-4 text-slate-300 transition-all duration-500 group-hover:animate-pulse group-hover:text-slate-500"/></div><div className="relative mt-4 text-[11px] font-semibold text-slate-500">{title}</div><div className="relative mt-1 text-[27px] font-black tracking-tight text-slate-950 transition-transform duration-300 group-hover:translate-x-0.5">{value}</div><div className="relative mt-auto pt-2 text-[10px] font-medium text-slate-400">{hint}</div></div>}

function Section({title,children,right}:{title:string;children:any;right?:any}){return <section className={`mb-4 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(15,23,42,0.08)] ${title.includes("Employee Confirmation") ? "employee-performance-section" : ""}`}><div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/70 px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="h-5 w-1 rounded-full bg-slate-900"/><h2 className="truncate text-[13px] font-black tracking-tight text-slate-900">{title}</h2></div>{right}</div>{children}</section>}

function PipelineCard({data,title="Web Orders",accent="indigo"}:{data:any;title?:string;accent?:"indigo"|"violet"}){const [open,setOpen]=useState(false);const total=Number(data?.total??0),confirmed=Number(data?.confirmed??0),processing=Number(data?.processing??0),cancelled=Number(data?.cancelled??0),active=Number(data?.active??0);const indigo=accent==="indigo";const stats=[{label:"Confirmed",value:confirmed,icon:CheckCircle2,tone:"text-emerald-700 bg-emerald-50 border-emerald-100"},{label:"Processing",value:processing,icon:Clock3,tone:"text-amber-700 bg-amber-50 border-amber-100"},{label:"Cancelled",value:cancelled,icon:XCircle,tone:"text-rose-700 bg-rose-50 border-rose-100"}];return <div className="min-w-0"><div onClick={()=>setOpen(v=>!v)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setOpen(v=>!v)}} className={`group relative flex h-full min-h-[156px] min-w-0 cursor-pointer flex-col overflow-hidden rounded-[22px] border bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] ${open?(indigo?"border-indigo-300 ring-4 ring-indigo-50":"border-violet-300 ring-4 ring-violet-50"):(indigo?"border-indigo-100":"border-violet-100")}`}><div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150 ${indigo?"bg-indigo-100/50":"bg-violet-100/50"}`}/><div className="relative flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${open?(indigo?"bg-indigo-100":"bg-violet-100"):(indigo?"bg-indigo-50":"bg-violet-50")}`}><ShoppingCart className={`h-5 w-5 ${indigo?"text-indigo-600":"text-violet-600"}`}/></div><div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">{title}</div><div className="mt-0.5 text-[27px] font-black tracking-tight text-slate-950">{enDigits(total)}</div><div className="truncate text-[9px] font-medium text-slate-400">{title === "Incomplete Orders" ? "Incomplete source · selected range" : "Real web orders · selected range"}</div>{title === "Incomplete Orders" && active > 0 && <div className="mt-1 text-[9px] font-bold text-violet-600">Active incomplete: {enDigits(active)}</div>}</div></div><div className="flex shrink-0 items-center gap-1"><span className={`rounded-full px-2 py-1 text-[8px] font-black tracking-wide transition-all duration-300 ${open?(indigo?"bg-indigo-600":"bg-violet-600")+" text-white":"bg-slate-100 text-slate-500"}`}>{open?"CLOSE":"DETAILS"}</span><ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-500 ${open?"rotate-180":""}`}/></div></div><div className={`relative grid transition-all duration-500 ease-out ${open?"mt-4 max-h-40 translate-y-0 opacity-100":"mt-0 max-h-0 translate-y-2 overflow-hidden opacity-0"}`}><div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">{stats.map(s=>{const Icon=s.icon;return <div key={s.label} className={`rounded-2xl border p-2.5 text-center transition duration-300 hover:-translate-y-0.5 ${s.tone}`}><Icon className="mx-auto h-4 w-4"/><div className="mt-1 text-lg font-black">{enDigits(s.value)}</div><div className="text-[8px] font-bold opacity-70">{s.label}</div></div>})}</div></div><div className={`relative mt-auto flex items-center justify-center gap-1 pt-2 text-[9px] font-semibold text-slate-400 transition-opacity duration-300 ${open?"opacity-0":"opacity-100"}`}>Confirmed + Processing + Cancelled <ChevronDown className="h-3 w-3"/></div></div></div>}

function TodayVisitorsCard({today,processing}:{today:number;processing:number}){return <div className="group relative flex min-h-[156px] h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-sky-100 bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)]"><div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sky-100/60 blur-2xl transition-transform duration-700 group-hover:scale-150"/><div className="relative grid h-full grid-cols-1 gap-3 sm:grid-cols-2"><div className="flex min-w-0 items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 ring-1 ring-sky-100 transition-all duration-500 group-hover:scale-110"><Users className="h-5 w-5 text-sky-600"/></div><div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">আজকের ভিজিটর</div><div className="mt-0.5 text-[28px] font-black tracking-tight text-slate-950">{enDigits(today)}</div><div className="mt-1 text-[9px] leading-relaxed text-slate-400">Home ও সব landing page-এর unique visitor</div></div></div><div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3 transition-transform duration-300 group-hover:translate-x-0.5"><div className="flex items-center justify-between gap-2"><div><div className="text-[9px] font-black text-amber-700">Total Processing</div><div className="mt-0.5 text-[26px] font-black text-slate-950">{enDigits(processing)}</div><div className="text-[8px] leading-relaxed text-amber-700/70">Web Pending / Processing</div></div><Clock3 className="h-5 w-5 shrink-0 text-amber-600"/></div><div className="mt-2 flex items-center gap-1 text-[8px] font-black text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"/>LIVE</div></div></div></div>}

function ConfirmedSalesProfitCard({data}:{data:any}){const [open,setOpen]=useState(false);const p=data??{};const gross=Number(p.grossSales||0),net=Number(p.netProfit||0),productCost=Number(p.productCost||0),adUsd=Number(p.adSpendUsd||0),adBdt=Number(p.adSpendBdt||0),courier=Number(p.courierCost||0),cancelAdjustment=Number(p.cancellationAdjustment||0),margin=Number(p.netProfitMargin||0),rate=Number(p.dollarRate||0),orders=Number(p.confirmedOrders||0),courierPerOrder=Number(p.courierCostPerOrder||0),cancelRate=Number(p.cancelRate||0);const money=(v:number)=>taka(Math.round(v));return <div onClick={()=>setOpen(v=>!v)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setOpen(v=>!v)}} className={`group relative min-w-0 cursor-pointer overflow-hidden rounded-[22px] border bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] ${open?"border-emerald-300 ring-4 ring-emerald-50":"border-emerald-100"}`}><div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/50 blur-2xl transition-transform duration-700 group-hover:scale-150"/><div className="relative flex min-h-[156px] flex-col"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50"><TrendingUp className="h-5 w-5 text-emerald-600"/></div><div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">Confirmed Sales</div><div className="mt-0.5 text-[25px] font-black tracking-tight text-slate-950">{money(gross)}</div><div className="text-[9px] text-slate-400">Confirmed real orders · selected range</div></div></div><div className="flex shrink-0 items-center gap-1"><span className={`rounded-full px-2 py-1 text-[8px] font-black ${open?"bg-emerald-600 text-white":"bg-emerald-50 text-emerald-700"}`}>{open?"CLOSE":"DETAILS"}</span><ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-500 ${open?"rotate-180":""}`}/></div></div><div className="mt-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3"><div className="flex items-center justify-between gap-2"><div><div className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-600">Real Net Profit</div><div className={`mt-0.5 text-xl font-black ${net>=0?"text-emerald-700":"text-rose-700"}`}>{money(net)}</div></div><div className="text-right"><div className="text-[8px] text-slate-400">Margin</div><div className={`text-sm font-black ${net>=0?"text-emerald-700":"text-rose-700"}`}>{margin.toFixed(2)}%</div></div></div></div><div className={`grid transition-all duration-500 ${open?"mt-3 max-h-96 opacity-100":"max-h-0 overflow-hidden opacity-0"}`}><div className="space-y-2 border-t border-slate-100 pt-3 text-[9px]"><div className="flex justify-between"><span className="text-slate-500">Gross Sales</span><b>{money(gross)}</b></div><div className="flex justify-between text-rose-600"><span>Product Cost</span><b>− {money(productCost)}</b></div><div className="flex justify-between text-rose-600"><span>Meta Ads ({adUsd.toFixed(2)} × ৳{rate.toFixed(2)})</span><b>− {money(adBdt)}</b></div><div className="flex justify-between text-rose-600"><span>Courier ({enDigits(orders)} × ৳{courierPerOrder.toFixed(0)})</span><b>− {money(courier)}</b></div><div className="flex justify-between text-rose-600"><span>Cancellation Adjustment ({cancelRate.toFixed(1)}%)</span><b>− {money(cancelAdjustment)}</b></div><div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-[10px]"><b>Real Net Profit</b><b className={net>=0?"text-emerald-700":"text-rose-700"}>{money(net)}</b></div></div></div></div></div>}

type EmployeeMetric = "web_confirm" | "incomplete_confirm" | "massage_confirm" | "web_cancel" | "incomplete_cancel" | "massage_cancel" | "live_processing";

function EmployeeMetricModal({ employee, metric, range, onClose }: { employee: any; metric: EmployeeMetric; range: DashboardRange; onClose: () => void }) {
  const fetchOrders = useServerFn(getEmployeeMetricOrders);
  const bulkUpdate = useServerFn(bulkUpdateEmployeeMetricOrders);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [nextStatus, setNextStatus] = useState<"web_pending" | "pending" | "rts" | "shipped" | "delivered" | "pending_return" | "returned" | "partial" | "cancelled" | "hold">("pending");
  const [saving, setSaving] = useState(false);
  const title = metric === "web_confirm" ? "Web Confirmed Orders" : metric === "incomplete_confirm" ? "Incomplete Confirmed Orders" : metric === "massage_confirm" ? "Massage Confirmed Orders" : metric === "web_cancel" ? "Web Cancelled Orders" : metric === "incomplete_cancel" ? "Incomplete Cancelled Orders" : metric === "massage_cancel" ? "Massage Cancelled Orders" : "Live Processing Orders";

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["employee-metric-orders", employee.user_id, metric, range.from, range.to],
    queryFn: () => fetchOrders({ data: { userId: employee.user_id, metric, from: range.from, to: range.to } }),
  });

  const allIds = orders.map((o: any) => String(o.id));
  const allSelected = allIds.length > 0 && selected.length === allIds.length;
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const applyStatus = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      await bulkUpdate({ data: { orderIds: selected, status: nextStatus } });
      toast.success(`${selected.length} টি অর্ডারের স্ট্যাটাস আপডেট হয়েছে`);
      setSelected([]);
      await refetch();
      qc.invalidateQueries({ queryKey: ["business-dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["order-status-counts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "স্ট্যাটাস আপডেট ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-2 sm:p-4" onClick={onClose}>
    <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-4 py-3.5 sm:px-5">
        <div className="min-w-0"><div className="text-sm font-black text-slate-900">{employee.name} · {title}</div><div className="mt-0.5 text-[9px] font-medium text-slate-400">{orders.length} টি অর্ডার · নির্বাচিত {selected.length} টি</div></div>
        <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200" aria-label="Close"><XCircle className="h-4 w-4"/></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />সব সিলেক্ট</label>
        <div className="flex items-center gap-2">
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
            <option value="pending">Pending</option><option value="rts">RTS (Ready to Ship)</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="pending_return">Return Pending</option><option value="returned">Returned</option><option value="partial">Partial</option><option value="hold">Hold</option><option value="cancelled">Cancelled</option><option value="web_pending">Processing</option>
          </select>
          <button disabled={!selected.length || saving} onClick={() => void applyStatus()} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Updating..." : `Update ${selected.length || ""}`.trim()}</button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? <div className="p-10 text-center text-xs text-slate-400">অর্ডার লোড হচ্ছে...</div> : !orders.length ? <div className="p-10 text-center text-xs text-slate-400">এই সময়সীমায় কোনো অর্ডার পাওয়া যায়নি</div> :
          <div className="divide-y divide-slate-100">{orders.map((o: any) => <div key={o.id} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-slate-50/80 sm:px-5">
            <input type="checkbox" checked={selected.includes(String(o.id))} onChange={() => toggleOne(String(o.id))} className="h-4 w-4 shrink-0 rounded border-slate-300" />
            <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-[10px] font-black text-slate-500">#{String(o.invoice_no ?? o.id).slice(0, 14).toUpperCase()}</span><span className="truncate text-[11px] font-bold text-slate-800">{o.customer_name || "—"}</span><span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">{o.customer_phone || "—"}</span></div></div>
            <div className="hidden shrink-0 text-right sm:block"><div className="text-[10px] font-black text-slate-700">{taka(Number(o.total ?? 0))}</div><div className="text-[8px] text-slate-400">{o.archived ? "Archived" : "Live"}</div></div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black text-slate-600">{statusLabel(o.status)}</span>
          </div>)}</div>}
      </div>
    </div>
  </div>;
}

function MonthlyBonusCard() {
<style>{`
@media (min-width: 1024px) {
  .employee-performance-section > div:first-child {
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 16px;
    padding-bottom: 16px;
  }
  .employee-performance-section > div:first-child h2 {
    font-size: 16px;
  }
  .employee-performance-section > .divide-y > .group {
    padding: 16px 20px;
  }
  .employee-performance-section > .divide-y > .group > .text-xs {
    font-size: 14px;
  }

  .monthly-bonus-card {
    margin-left: 20px;
    margin-right: 20px;
    margin-top: 14px;
    margin-bottom: 14px;
    padding: 20px;
    border-radius: 22px;
  }
  .monthly-bonus-card .h-9.w-9 {
    width: 44px;
    height: 44px;
  }
  .monthly-bonus-card .h-9.w-9 svg {
    width: 20px;
    height: 20px;
  }
  .monthly-bonus-card .text-\[12px\] {
    font-size: 17px;
  }
  .monthly-bonus-card .text-\[9px\] {
    font-size: 12px;
  }
  .monthly-bonus-card .text-base {
    font-size: 24px;
  }
  .monthly-bonus-card .text-\[7px\] {
    font-size: 10px;
  }
  .monthly-bonus-card .text-\[8px\] {
    font-size: 11px;
  }
  .monthly-bonus-card .h-1\.5 {
    height: 8px;
  }

  .employee-performance-self-card {
    margin-left: 20px;
    margin-right: 20px;
    margin-top: 14px;
    margin-bottom: 14px;
    padding: 20px;
    border-radius: 22px;
  }
  .employee-performance-self-card .h-9.w-9 {
    width: 44px;
    height: 44px;
  }
  .employee-performance-self-card .h-9.w-9 svg {
    width: 20px;
    height: 20px;
  }
  .employee-performance-self-card .text-\[12px\] {
    font-size: 17px;
  }
  .employee-performance-self-card .text-\[9px\] {
    font-size: 12px;
  }
  .employee-performance-self-card .text-base {
    font-size: 24px;
  }
  .employee-performance-self-card .text-\[7px\] {
    font-size: 10px;
  }
  .employee-performance-self-card .text-\[8px\] {
    font-size: 11px;
  }
  .employee-performance-self-card .text-\[8px\].leading-3\.5 {
    line-height: 1.5;
  }
}
`}</style>
  const { user } = useAuth();
  const fetchBonus = useServerFn(getEmployeeMonthlyBonusProgress);
  const [showDetails, setShowDetails] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["employee-monthly-bonus"],
    queryFn: () => fetchBonus(),
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  if (data?.visible === false) return null;
  const confirmed = Number(data?.confirmed ?? 0);
  const delivered = Number(data?.delivered ?? 0);
  const cancelled = Number(data?.cancelled ?? 0);
  const target = Number(data?.target ?? 300);
  const confirmProgress = Math.min(100, (confirmed / target) * 100);
  const deliveryProgress = Math.min(100, (delivered / target) * 100);

  return <>
    <div className="monthly-bonus-card relative mx-3 my-2.5 overflow-hidden rounded-[18px] border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 p-3 sm:mx-4">
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-100/70 blur-2xl"/>
      <div className="relative">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles className="h-4 w-4"/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-[12px] font-black text-slate-900">Hello, {data?.employeeName ?? "আপনি"}, 👋</div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setShowDetails(true)} className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[7px] font-black text-slate-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">বিস্তারিত দেখুন</button>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[7px] font-black uppercase tracking-wide text-amber-700"><LockKeyhole className="h-2.5 w-2.5"/> Locked</span>
              </div>
            </div>
            <div className="mt-0.5 text-[9px] leading-4 text-slate-600"><b className="text-emerald-700">🎉 Good News!</b> আগামী মাসের ১ তারিখ থেকে <b>Monthly Bonus</b> চালু হবে। এক মাসে Incomplete Order থেকে <b>৩০০টি Confirm</b> করে Delivery সম্পন্ন করতে পারলে মাস শেষে পাবেন <b className="text-emerald-700">৳২,০০০ Extra Bonus</b>। 💰</div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-xl border border-emerald-100 bg-white/90 px-2 py-2 text-center"><div className="text-base font-black text-emerald-700">{isLoading ? "—" : enDigits(confirmed)}</div><div className="text-[7px] font-bold text-slate-400">INCOMPLETE CONFIRM</div></div>
          <div className="rounded-xl border border-blue-100 bg-white/90 px-2 py-2 text-center"><div className="text-base font-black text-blue-700">{isLoading ? "—" : enDigits(delivered)}</div><div className="text-[7px] font-bold text-slate-400">DELIVERED</div></div>
          <div className="rounded-xl border border-rose-100 bg-white/90 px-2 py-2 text-center"><div className="text-base font-black text-rose-600">{isLoading ? "—" : enDigits(cancelled)}</div><div className="text-[7px] font-bold text-slate-400">CANCELLED</div></div>
        </div>

        <div className="mt-2 rounded-xl border border-white/90 bg-white/75 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[8px] font-black text-slate-500"><span>এই মাসের Current Progress</span><span className="text-emerald-700">{enDigits(confirmed)} / {enDigits(target)} Confirm</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{width: `${confirmProgress}%`}}/></div>
          <div className="mt-1.5 flex items-center justify-between text-[7px] font-semibold text-slate-500"><span>Delivered: <b className="text-blue-700">{enDigits(delivered)} / {enDigits(target)}</b></span><span>Cancel: <b className="text-rose-600">{enDigits(cancelled)}</b></span></div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{width: `${deliveryProgress}%`}}/></div>
        </div>

        <div className="mt-2 text-[8px] font-semibold leading-3.5 text-slate-500">🔥 প্রতিদিন গড়ে ১৫টি Incomplete Order Confirm করার লক্ষ্য রাখুন। নিয়মিত Follow-up ও ভালোভাবে Customer Convince করলে Target পূরণে সাহায্য করবে।</div>
        <div className="mt-1.5 flex items-center justify-center gap-1 rounded-lg bg-slate-900/[0.04] px-2.5 py-1.5 text-[7px] font-bold text-slate-500"><LockKeyhole className="h-2.5 w-2.5"/> Bonus এখন Locked — আগামী মাসের ১ তারিখ থেকে Progress গণনা Bonus-এর জন্য কার্যকর হবে।</div>
      </div>
    </div>

    {showDetails && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px]" onClick={() => setShowDetails(false)}>
      <div className="relative w-full max-w-md overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Sparkles className="h-4 w-4"/></div>
            <div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-900">Monthly Bonus · বিস্তারিত</div><div className="text-[8px] text-slate-400">আপনার লক্ষ্য ও Bonus পাওয়ার নিয়ম</div></div>
            <button type="button" onClick={() => setShowDetails(false)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-label="Close"><XCircle className="h-4 w-4"/></button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-3.5 py-3">
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3 text-[9px] font-black leading-4 text-slate-800">আপনি যদি এক মাসে Incomplete Order থেকে ৩০০টি অর্ডার Confirm করে Delivery সম্পন্ন করতে পারেন, তাহলে মাস শেষে পাবেন <span className="text-emerald-700">৳২,০০০ Extra Bonus</span>। 💰</div>
          <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[9px] font-bold leading-4 text-slate-700">আমাদের হিসাব অনুযায়ী সাধারণত <b>১৫টি Order Confirm</b> করলে গড়ে <b>১০টি Delivery</b> হয়। তাই প্রতিদিন গড়ে <b>১৫টি Incomplete Order Confirm</b> করতে পারলে আশা করা যায় মাস শেষে আপনার <b>৩০০ Delivery-এর Target</b> পূরণ করা সম্ভব হবে।</div>
          <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><div className="text-[9px] font-black text-amber-800">🔥 Incomplete Order বেশি Confirm করার কৌশল:</div><div className="mt-1.5 text-[9px] font-medium leading-4 text-slate-600">কাস্টমারের সঙ্গে ভালোভাবে কথা বলে তাকে কনভিন্স করার চেষ্টা করবেন। প্রয়োজন হলে আকর্ষণীয় Offer দিতে পারেন, কোনো ছোট Gift/Free Item অফার করতে পারেন, অথবা কাস্টমারের প্রয়োজন অনুযায়ী অন্যভাবে তাকে অর্ডারটি Confirm করতে উৎসাহিত করবেন।</div></div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[9px] font-black leading-4 text-slate-700">💪 নিয়মিত Follow-up + ভালোভাবে Customer Convince = <span className="text-emerald-700">Target Complete + ৳২,০০০ Bonus</span> 🎯</div>
          <div className="mt-2 rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white px-3 py-2 text-center text-[9px] font-bold text-rose-700">আশা করি আপনি Target-টা সুন্দরভাবে Complete করতে পারবেন। Best of luck! ❤️</div>
        </div>
        <div className="border-t border-slate-100 bg-white px-3.5 py-2.5"><button type="button" onClick={() => setShowDetails(false)} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-[9px] font-black text-white">বুঝতে পারছি</button></div>
      </div>
    </div>}
  </>;
}
function statusLabel(status: string) {
  const labels: Record<string, string> = { web_pending:"Processing", pending:"Pending", rts:"RTS", shipped:"Shipped", delivered:"Delivered", pending_return:"Return Pending", returned:"Returned", partial:"Partial", cancelled:"Cancelled", hold:"Hold", incomplete:"Incomplete" };
  return labels[status] ?? status;
}

export function PremiumDashboard(){const {isSuperAdmin,isAdmin,permissions,user,role}=useAuth();const can=(k:string)=>isSuperAdmin||isAdmin||(permissions as any)?.[k]!==false;const [employeeMetric,setEmployeeMetric]=useState<{employee:any;metric:EmployeeMetric}|null>(null);const fetchReport=useServerFn(getOptimizedDashboardReport);const fetchProcessing=useServerFn(getWebProcessingOrderCount);const fetchEmployeeLiveProcessing=useServerFn(getEmployeeLiveProcessingCounts);const qc=useQueryClient();const [preset,setPreset]=useState<DashboardPreset>("today");const [range,setRange]=useState<DashboardRange>(()=>getDashboardPresetRange("today")!);const [refreshing,setRefreshing]=useState(false);useEffect(()=>{try{const raw=window.localStorage.getItem("business-dashboard-filter-v1");if(!raw)return;const saved=JSON.parse(raw);if(saved?.preset&&saved?.range?.from&&saved?.range?.to){setPreset(saved.preset);setRange(saved.range)}}catch{}},[]);const {data,isFetching,refetch}=useQuery({queryKey:["business-dashboard",range.from,range.to],queryFn:()=>fetchReport({data:range}),staleTime:300000,refetchOnWindowFocus:false});const {data:processingCount=0}=useQuery({queryKey:["live-web-processing"],queryFn:()=>fetchProcessing(),staleTime:15000,refetchOnWindowFocus:false,refetchInterval:30000,refetchIntervalInBackground:false});const {data:employeeLiveProcessing=[]}=useQuery({queryKey:["employee-live-processing"],queryFn:()=>fetchEmployeeLiveProcessing(),staleTime:20000,refetchOnWindowFocus:false,refetchInterval:30000,refetchIntervalInBackground:false});const employeeLiveMap=new Map((employeeLiveProcessing as any[]).map((x:any)=>[String(x.user_id),Number(x.live_processing??0)]));useEffect(()=>{let scheduled:number|null=null;const refresh=()=>{qc.invalidateQueries({queryKey:["live-web-processing"],refetchType:"active"});if(document.hidden||scheduled!==null)return;scheduled=window.setTimeout(()=>{scheduled=null;qc.invalidateQueries({queryKey:["business-dashboard"],refetchType:"active"})},300000)};const ch=supabase.channel("dashboard-live").on("postgres_changes",{event:"*",schema:"public",table:"orders"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"products"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"incomplete_orders"},refresh).subscribe();const t=window.setInterval(()=>{if(!document.hidden)qc.invalidateQueries({queryKey:["business-dashboard"],refetchType:"active"})},300000);return()=>{if(scheduled!==null)window.clearTimeout(scheduled);supabase.removeChannel(ch);window.clearInterval(t)}},[qc]);const r:any=data??{real:{revenue:0},profit:{grossSales:0,netProfit:0,productCost:0,adSpendUsd:0,adSpendBdt:0,dollarRate:122,confirmedOrders:0,courierCost:0,courierCostPerOrder:50,cancelRate:20,cancellationAdjustment:0,netProfitMargin:0},webOrders:{total:0,confirmed:0,processing:0,cancelled:0},incompleteOrders:{total:0,confirmed:0,processing:0,cancelled:0,active:0},daily:[],hourly:[],bestSelling:[],lowStock:[],stockSummary:{out:0,low:0,total:0},todayVisitors:0,employeePerformance:[]};const refresh=async()=>{setRefreshing(true);await refetch();setRefreshing(false)};const onFilterChange=(next:DashboardPreset,nextRange:DashboardRange|null)=>{if(!nextRange)return;setPreset(next);setRange(nextRange);try{window.localStorage.setItem("business-dashboard-filter-v1",JSON.stringify({preset:next,range:nextRange}))}catch{}};return <AdminLayout><div className="min-h-full bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.07),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.05),_transparent_28%),#f7f9fc] px-2 pb-10 sm:px-3"><div className="sticky top-0 z-20 mb-4 flex flex-col gap-3 border-b border-slate-200/70 bg-[#f7f9fc]/90 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 shadow-lg"><span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400"/></div><div className="min-w-0"><div className="truncate text-base font-black tracking-tight text-slate-950">Business Command Center</div><div className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400"><span className="animate-pulse">●</span> Live database analytics · Dhaka Time</div></div></div><div className="flex w-full items-center gap-2 sm:w-auto"><div className="min-w-0 flex-1 sm:flex-none"><DashboardTimeFilter value={preset} onChange={onFilterChange}/></div><button onClick={refresh} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-md active:scale-95" aria-label="Refresh dashboard"><RefreshCw className={`h-4 w-4 ${refreshing||isFetching?"animate-spin":""}`}/></button></div></div><div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{can("dash_visitors")&&<TodayVisitorsCard today={r.todayVisitors} processing={Number(processingCount)}/>}{can("dash_web_orders")&&<PipelineCard data={r.webOrders} title="Web Orders" accent="indigo"/>}{can("dash_incomplete")&&<PipelineCard data={r.incompleteOrders} title="Incomplete Orders" accent="violet"/>}{can("dash_confirmed_sales")&&<ConfirmedSalesProfitCard data={r.profit}/>}{can("dash_stock_alerts")&&<Card title="Stock Alerts" value={enDigits(r.stockSummary.out+r.stockSummary.low)} hint={`${enDigits(r.stockSummary.out)} out · ${enDigits(r.stockSummary.low)} low · current`} icon={AlertTriangle} tone="border-orange-100"/>}{can("dash_ads")&&<MetaAdsResultCard range={range}/>}</div><div className="grid gap-4 xl:grid-cols-2">{can("dash_top_selling")&&<Section title="Top Selling Products · Real Orders"><div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">{r.bestSelling.slice(0,20).map((x:any,i:number)=><div key={x.product_name||x.name} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-slate-50/80 sm:px-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-600 ring-1 ring-indigo-100 transition-transform duration-300 group-hover:scale-105">{i+1}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-slate-800">{x.product_name||x.name}</div><div className="truncate text-[9px] text-slate-400">{x.landingPages?.length?`Landing: ${x.landingPages.map((p:any)=>p.title).join(", ")}:`:""}</div></div><div className="shrink-0 text-right"><div className="text-sm font-black text-slate-900">{enDigits(Number(x.order_count ?? x.units ?? 0))} orders</div><div className="text-[10px] font-medium text-slate-400">{enDigits(Number(x.units ?? 0))} pcs · {taka(x.revenue)}</div></div></div>)}{!r.bestSelling.length&&<div className="p-8 text-center text-xs text-slate-400">No real confirmed sales in this period</div>}</div></Section>}{can("dash_employee_perf")&&<Section title="Employee Confirmation Performance · All Sources"><div className="divide-y divide-slate-100">{role === "employee" && <MonthlyBonusCard />}{role === "employee" && (() => {
  const mine = r.employeePerformance.find((x:any) => String(x.user_id) === String(user?.id));
  if (!mine) return null;
  const webConfirmed = Number(mine.web_confirmed ?? 0);
  const incompleteConfirmed = Number(mine.incomplete_confirmed ?? 0);
  const cancelled = Number(mine.cancelled ?? 0);
  const rate = webConfirmed > 0 ? (cancelled / webConfirmed) * 100 : 0;
  const performers = r.employeePerformance.filter((x:any) => x.order_division_active === true && Number(x.web_confirmed ?? 0) > 0);
  const topPerformer = [...performers].sort((a:any,b:any) => {
    const ar=Number(a.web_confirmed ?? 0)>0 ? Number(a.cancelled ?? 0)/Number(a.web_confirmed ?? 0) : 999;
    const br=Number(b.web_confirmed ?? 0)>0 ? Number(b.cancelled ?? 0)/Number(b.web_confirmed ?? 0) : 999;
    return ar-br || Number(b.web_confirmed ?? 0)-Number(a.web_confirmed ?? 0);
  })[0];
  const isTop = topPerformer && String(topPerformer.user_id) === String(mine.user_id);
  const tone = rate <= 10 ? "emerald" : rate <= 15 ? "amber" : "rose";
  const copy = rate <= 10
    ? `দারুণ কাজ, ${mine.name || "আপনি"}! আপনার Web Cancellation Rate ${rate.toFixed(1)}% — প্রতি ১০০টি Web অর্ডারের মধ্যে অন্তত ৯০টি Confirm করার লক্ষ্যে আপনি ভালোভাবে কাজ করছেন।`
    : rate <= 15
      ? `আপনার Web Cancellation Rate ${rate.toFixed(1)}% — অর্থাৎ প্রতি ১০০টি Web অর্ডারের মধ্যে প্রায় ${Math.round(rate)}টি Cancel হয়েছে, যা স্বাভাবিক ১০% সীমার চেয়ে কিছুটা বেশি। চেষ্টা করবেন প্রতি ১০০টি অর্ডারের মধ্যে অন্তত ৯০টি Confirm করতে।\\n\\nকাস্টমারের সাথে কথা বলার সময় পণ্যের সুবিধা, আমাদের সাপোর্ট সিস্টেম, পণ্যের প্রয়োজনীয়তা এবং ডেলিভারি সংক্রান্ত বিষয়গুলো পরিষ্কারভাবে বুঝিয়ে অর্ডারটি নিশ্চিত করার দিকে গুরুত্ব দিন। প্রয়োজনে উপযুক্ত কিছু গিফট বা আকর্ষণীয় অফার দিয়ে কাস্টমারকে সন্তুষ্ট করে অর্ডারটি Confirm করার সর্বোচ্চ চেষ্টা করুন।`
      : `আপনার Web Cancellation Rate ${rate.toFixed(1)}% — অর্থাৎ প্রতি ১০০টি Web অর্ডারের মধ্যে প্রায় ${Math.round(rate)}টি Cancel হয়েছে, যা স্বাভাবিক ১০% সীমার চেয়ে বেশি। চেষ্টা করবেন প্রতি ১০০টি অর্ডারের মধ্যে অন্তত ৯০টি Confirm করতে।\\n\\nকাস্টমারের সাথে কথা বলার সময় পণ্যের সুবিধা, আমাদের সাপোর্ট সিস্টেম, পণ্যের প্রয়োজনীয়তা এবং ডেলিভারি সংক্রান্ত বিষয়গুলো পরিষ্কারভাবে বুঝিয়ে অর্ডারটি নিশ্চিত করার দিকে গুরুত্ব দিন। প্রয়োজনে উপযুক্ত কিছু গিফট বা আকর্ষণীয় অফার দিয়ে কাস্টমারকে সন্তুষ্ট করে অর্ডারটি Confirm করার সর্বোচ্চ চেষ্টা করুন।`;
  const toneMap:any={
    emerald:{wrap:"border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40",icon:"bg-emerald-100 text-emerald-700",accent:"text-emerald-700",bar:"bg-emerald-500",track:"bg-emerald-100"},
    amber:{wrap:"border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40",icon:"bg-amber-100 text-amber-700",accent:"text-amber-700",bar:"bg-amber-500",track:"bg-amber-100"},
    rose:{wrap:"border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-50/40",icon:"bg-rose-100 text-rose-700",accent:"text-rose-700",bar:"bg-rose-500",track:"bg-rose-100"}
  }[tone];
  return <div className={`employee-performance-self-card relative mx-3 my-2.5 overflow-hidden rounded-[18px] border p-3 shadow-sm sm:mx-4 ${toneMap.wrap}`}>
    <div className="relative">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${toneMap.icon}`}><Sparkles className="h-4 w-4"/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-[12px] font-black text-slate-900">হ্যালো, {mine.name || "আপনি"}! 👋</div>
            {isTop&&<span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-1.5 py-0.5 text-[7px] font-black text-emerald-700">★ TOP PERFORMER</span>}
          </div>
          <div className="mt-0.5 text-[9px] leading-4 text-slate-600">আপনার <b className="text-slate-900">{enDigits(webConfirmed)}টি Web Confirm</b> এবং <b className="text-cyan-700">{enDigits(incompleteConfirmed)}টি Incomplete Confirm</b> আছে। Cancellation Rate-এর হিসাব শুধু <b className="text-slate-900">Web Confirm</b> অর্ডারের ওপর করা হচ্ছে।</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <div className="rounded-xl border border-white/90 bg-white/85 px-2 py-1.5 text-center"><div className="text-base font-black text-emerald-600">{enDigits(webConfirmed)}</div><div className="text-[7px] font-bold text-slate-400">WEB CONFIRM</div></div>
        <div className="rounded-xl border border-white/90 bg-white/85 px-2 py-1.5 text-center"><div className="text-base font-black text-rose-600">{enDigits(cancelled)}</div><div className="text-[7px] font-bold text-slate-400">WEB CANCELLED</div></div>
        <div className="rounded-xl border border-white/90 bg-white/85 px-2 py-1.5 text-center"><div className={`text-base font-black ${toneMap.accent}`}>{rate.toFixed(1)}%</div><div className="text-[7px] font-bold text-slate-400">WEB CANCEL RATE</div></div>
      </div>
      <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 text-[7px] font-black"><span className="flex items-center gap-1 text-slate-500"><Target className="h-2.5 w-2.5"/> BENCHMARK · ≤ 10%</span><span className={toneMap.accent}>{rate.toFixed(1)}%</span></div>
        <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${toneMap.track}`}><div className={`h-full rounded-full ${toneMap.bar}`} style={{width:`${Math.min(rate,100)}%`}}/></div>
        <div className={`mt-1.5 text-[8px] font-semibold leading-3.5 ${toneMap.accent}`}>{copy}</div>
      </div>
      {incompleteConfirmed > 0 && <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-2.5 py-2"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700"><CheckCircle2 className="h-3.5 w-3.5"/></div><div className="text-[8px] font-semibold leading-3.5 text-cyan-800"><b>Incomplete থেকে {enDigits(incompleteConfirmed)}টি Confirm — খুব ভালো!</b></div></div>}
      {topPerformer && !isTop && <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50 to-white px-2.5 py-2"><div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><TrendingUp className="h-3.5 w-3.5"/></div><div className="text-[8px] font-semibold leading-3.5 text-amber-800"><b>{topPerformer.name}</b> আজকে খুব ভালো কাজ করছে — {enDigits(Number(topPerformer.web_confirmed ?? 0))}টি Confirm এবং {enDigits(Number(topPerformer.cancelled ?? 0))}টি Cancel; Web Cancellation Rate {(Number(topPerformer.cancelled ?? 0)/Math.max(Number(topPerformer.web_confirmed ?? 0),1)*100).toFixed(1)}%। তুলনামূলকভাবে তার পারফরম্যান্স ভালো। চাইলে তার কৌশল অনুসরণ করে আরও ভালো ফল করতে পারেন।</div></div>}
    </div>
  </div>;
})()}{r.employeePerformance.slice(0,10).map((x:any,i:number)=><div key={x.user_id||x.name} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-slate-50/80 sm:px-5"><span className="text-xs font-black text-slate-400">#{i+1}</span><div className="flex-1 min-w-0"><div className="truncate text-xs font-bold text-slate-800">{x.name}</div></div><div className="shrink-0 flex items-center gap-1.5 text-right">{(isAdmin || isSuperAdmin) ? <><button onClick={() => setEmployeeMetric({ employee:x, metric:"web_confirm" })} className="rounded-lg px-2 py-1 transition hover:bg-emerald-50" title="View confirmed orders"><div className="text-lg font-black text-emerald-600">{enDigits(Number(x.web_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">web confirm</div></button><button onClick={() => setEmployeeMetric({ employee:x, metric:"incomplete_confirm" })} className="rounded-lg px-2 py-1 transition hover:bg-cyan-50" title="View incomplete confirmed orders"><div className="text-sm font-black text-cyan-600">{enDigits(Number(x.incomplete_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">incomplete confirm</div></button><button onClick={() => setEmployeeMetric({ employee:x, metric:"massage_confirm" })} className="rounded-lg px-2 py-1 transition hover:bg-amber-50" title="View massage confirmed orders"><div className="text-sm font-black text-amber-600">{enDigits(Number(x.massage_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">massage confirm</div></button><div className="h-7 w-px bg-slate-200"/><button onClick={() => setEmployeeMetric({ employee:x, metric:"web_cancel" })} className="rounded-lg px-2 py-1 transition hover:bg-rose-50" title="View web cancelled orders"><div className="text-sm font-black text-rose-600">{enDigits(x.cancelled)}</div><div className="text-[8px] font-medium text-slate-400">web cancel</div></button><button onClick={() => setEmployeeMetric({ employee:x, metric:"incomplete_cancel" })} className="rounded-lg px-2 py-1 transition hover:bg-violet-50" title="View incomplete cancelled orders"><div className="text-sm font-black text-violet-600">{enDigits(Number(x.incomplete_cancelled ?? x.incompleteCancelled ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">incomplete cancel</div></button><button onClick={() => setEmployeeMetric({ employee:x, metric:"massage_cancel" })} className="rounded-lg px-2 py-1 transition hover:bg-amber-50" title="View massage cancelled orders"><div className="text-sm font-black text-amber-600">{enDigits(Number(x.massage_cancelled ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">massage cancel</div></button><button onClick={() => setEmployeeMetric({ employee:x, metric:"live_processing" })} className="rounded-lg px-2 py-1 transition hover:bg-sky-50" title="View live processing orders"><div className="text-sm font-black text-sky-600">{enDigits(Number(employeeLiveMap.get(String(x.user_id)) ?? x.live_processing ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">live processing</div></button></> : <><div className="rounded-lg px-2 py-1" aria-label="web confirm"><div className="text-lg font-black text-emerald-600">{enDigits(Number(x.web_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">web confirm</div></div><div className="rounded-lg px-2 py-1" aria-label="incomplete confirm"><div className="text-sm font-black text-cyan-600">{enDigits(Number(x.incomplete_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">incomplete confirm</div></div><div className="rounded-lg px-2 py-1" aria-label="massage confirm"><div className="text-sm font-black text-amber-600">{enDigits(Number(x.massage_confirmed ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">massage confirm</div></div><div className="h-7 w-px bg-slate-200"/><div className="rounded-lg px-2 py-1" aria-label="web cancel"><div className="text-sm font-black text-rose-600">{enDigits(x.cancelled)}</div><div className="text-[8px] font-medium text-slate-400">web cancel</div></div><div className="rounded-lg px-2 py-1" aria-label="incomplete cancel"><div className="text-sm font-black text-violet-600">{enDigits(Number(x.incomplete_cancelled ?? x.incompleteCancelled ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">incomplete cancel</div></div><div className="rounded-lg px-2 py-1" aria-label="massage cancel"><div className="text-sm font-black text-amber-600">{enDigits(Number(x.massage_cancelled ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">massage cancel</div></div><div className="rounded-lg px-2 py-1" aria-label="live processing"><div className="text-sm font-black text-sky-600">{enDigits(Number(employeeLiveMap.get(String(x.user_id)) ?? x.live_processing ?? 0))}</div><div className="text-[8px] font-medium text-slate-400">live processing</div></div></>}</div></div>)}{!r.employeePerformance.length&&<div className="p-8 text-center text-xs text-slate-400">No employee data</div>}</div></Section>}</div><div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">{can("dash_stock_control")&&<Section title="Stock Control"><div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5"><div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-center transition-all duration-300 hover:-translate-y-0.5"><Package className="mx-auto h-5 w-5 text-slate-400"/><div className="mt-1 text-xl font-black">{enDigits(r.stockSummary.total)}</div><div className="text-[9px] font-medium text-slate-400">Products · current</div></div><div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3 text-center transition-all duration-300 hover:-translate-y-0.5"><AlertTriangle className="mx-auto h-5 w-5 text-orange-500"/><div className="mt-1 text-xl font-black text-orange-600">{enDigits(r.stockSummary.low)}</div><div className="text-[9px] font-medium text-orange-400">Low Stock · current</div></div><div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3 text-center transition-all duration-300 hover:-translate-y-0.5"><AlertTriangle className="mx-auto h-5 w-5 text-rose-500"/><div className="mt-1 text-xl font-black text-rose-600">{enDigits(r.stockSummary.out)}</div><div className="text-[9px] font-medium text-rose-400">Out of Stock · current</div></div></div><div className="divide-y divide-slate-100">{r.lowStock.slice(0,8).map((x:any)=><div key={x.id} className="flex justify-between px-4 py-2.5 text-xs transition-colors hover:bg-slate-50/80 sm:px-5"><span className="truncate pr-3 font-semibold text-slate-600">{x.name}</span><b className={x.stock<=0?"text-rose-600":"text-orange-600"}>{x.stock<=0?"OUT":enDigits(x.stock)}</b></div>)}</div></Section>}{can("dash_hourly")&&<Section title="Hourly Real Web Order Activity"><div className="h-64 p-4 sm:h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.hourly}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eef2f7"/><XAxis dataKey="label" tick={{fontSize:8}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:8}} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:"rgba(99,102,241,0.04)"}}/><Bar dataKey="orders" name="Orders" fill="#6366f1" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div></Section>}</div></div>{employeeMetric&&<EmployeeMetricModal employee={employeeMetric.employee} metric={employeeMetric.metric} range={range} onClose={()=>setEmployeeMetric(null)}/>}</AdminLayout>;
}
