import { INTEGRATIONS_COLUMNS } from "@/lib/read-columns";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Facebook, Loader2, Save, TestTube2, XCircle } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";

const NAME = "meta_ad_account";
type Config = { app_id: string; app_secret: string; access_token: string; ad_account_id: string; pixel_id: string; account_name: string; account_id: string; dollar_rate: number; courier_cost_per_order: number; return_rate: number };
const empty: Config = { app_id: "", app_secret: "", access_token: "", ad_account_id: "", pixel_id: "", account_name: "", account_id: "", dollar_rate: 122, courier_cost_per_order: 50, return_rate: 25 };
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";
const btn = "inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50";

export function MetaAdAccountCard() {
  const [cfg, setCfg] = useState<Config>(empty);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => { const controller = new AbortController(); (async () => { const { data } = await supabase.from("integrations").select(INTEGRATIONS_COLUMNS).eq("name", NAME).abortSignal(controller.signal).maybeSingle(); if (controller.signal.aborted) return; if (data) { setActive(!!data.is_active); setCfg({ ...empty, ...((data.config as Partial<Config>) || {}) }); } setLoading(false); })(); return () => controller.abort(); }, []);

  const save = async () => { setSaving(true); const payload = { ...cfg, dollar_rate: Number(cfg.dollar_rate) || 0, courier_cost_per_order: Number(cfg.courier_cost_per_order) || 0, return_rate: Number(cfg.return_rate) || 0 }; const { error } = await supabase.from("integrations").upsert({ name: NAME, is_active: active, config: payload, updated_at: new Date().toISOString() }, { onConflict: "name" }); setSaving(false); if (error) toast.error(error.message); else toast.success("Meta Ad Account saved"); };

  const test = async () => {
    if (!cfg.access_token.trim() || !cfg.ad_account_id.trim()) { toast.error("Enter Access Token and Ad Account ID"); return; }
    setTesting(true);
    try {
      const id = cfg.ad_account_id.trim().replace(/^act_/, "");
      const res = await fetch(`https://graph.facebook.com/v23.0/act_${id}?fields=name,account_id&access_token=${encodeURIComponent(cfg.access_token.trim())}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data?.error?.message || "Meta connection failed");
      setCfg(s => ({ ...s, account_name: data.name || "Meta Ad Account", account_id: data.account_id || id }));
      setActive(true);
      toast.success(`Connected: ${data.name || "Meta Ad Account"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Meta connection failed"); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="rounded-2xl border bg-white p-6"><Loader2 className="h-5 w-5 animate-spin text-brand" /></div>;
  return <div className="animate-in fade-in slide-in-from-right-3 duration-300 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5"><Facebook className="h-5 w-5 text-blue-600" /></div><div><h2 className="text-lg font-bold text-slate-900">Meta Ad Account</h2><p className="text-xs text-slate-500">Meta Ads account connection</p></div>{active ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3"/> Connected</span> : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500"><XCircle className="h-3 w-3"/> Not connected</span>}</div><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="h-4 w-4"/> Enable</label></div>
    {active && cfg.account_name && <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Connected Ad Account</div><div className="mt-1 text-base font-extrabold text-emerald-900">{cfg.account_name}</div><div className="text-xs text-emerald-700">act_{cfg.account_id}</div></div>}
    <div className="grid gap-4 sm:grid-cols-2"><Field label="App ID"><input value={cfg.app_id} onChange={e=>setCfg({...cfg,app_id:e.target.value})} placeholder="Meta App ID" className={inputClass}/></Field><Field label="Ad Account ID"><input value={cfg.ad_account_id} onChange={e=>setCfg({...cfg,ad_account_id:e.target.value})} placeholder="act_123456789" className={inputClass}/></Field><Field label="App Secret"><SecretInput value={cfg.app_secret} show={showSecret} setShow={setShowSecret} onChange={v=>setCfg({...cfg,app_secret:v})} placeholder="Meta App Secret"/></Field><Field label="Access Token"><SecretInput value={cfg.access_token} show={showToken} setShow={setShowToken} onChange={v=>setCfg({...cfg,access_token:v})} placeholder="EAAG..."/></Field><Field label="Pixel ID (Optional)" full><input value={cfg.pixel_id} onChange={e=>setCfg({...cfg,pixel_id:e.target.value})} placeholder="Meta Pixel ID" className={inputClass}/></Field></div>
    <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><div className="mb-3"><h3 className="text-sm font-extrabold text-slate-900">Profit Calculation Settings</h3><p className="mt-1 text-[11px] text-slate-500">These values are used by the Dashboard Net Profit calculation.</p></div><div className="grid gap-4 sm:grid-cols-3"><Field label="USD Rate (৳ / $)"><input type="number" min="0" step="0.01" value={cfg.dollar_rate} onChange={e=>setCfg({...cfg,dollar_rate:Number(e.target.value)})} className={inputClass}/></Field><Field label="Courier Cost / Order (৳)"><input type="number" min="0" step="1" value={cfg.courier_cost_per_order} onChange={e=>setCfg({...cfg,courier_cost_per_order:Number(e.target.value)})} className={inputClass}/></Field><Field label="Average Return Rate (%)"><input type="number" min="0" max="100" step="0.1" value={cfg.return_rate} onChange={e=>setCfg({...cfg,return_rate:Number(e.target.value)})} className={inputClass}/></Field></div></div>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={test} disabled={testing} className={secondary}>{testing?<Loader2 className="h-4 w-4 animate-spin"/>:<TestTube2 className="h-4 w-4"/>}{testing?"Testing...":"Test & Connect"}</button><button onClick={save} disabled={saving} className={btn}><Save className="h-4 w-4"/>{saving?"Saving...":"Save"}</button></div>
    <p className="mt-4 text-[11px] text-slate-400">App Secret and Access Token remain masked. Ad spend is fetched from the connected Meta Ad Account.</p>
  </div>;
}
function Field({label,children,full=false}:{label:string;children:React.ReactNode;full?:boolean}){return <div className={full?"sm:col-span-2":""}><label className="text-xs font-bold text-slate-500">{label}</label><div className="mt-1.5">{children}</div></div>}
function SecretInput({value,show,setShow,onChange,placeholder}:{value:string;show:boolean;setShow:(v:boolean)=>void;onChange:(v:string)=>void;placeholder:string}){return <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10"><input type={show?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoComplete="off" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"/><button type="button" onClick={()=>setShow(!show)} className="p-1 text-slate-400 hover:text-slate-700">{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div>}
