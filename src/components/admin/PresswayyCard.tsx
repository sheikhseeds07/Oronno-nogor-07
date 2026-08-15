import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Link2, Loader2, RefreshCw, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getPresswayyStatus, registerPresswayy, resyncPresswayy, savePresswayy, testPresswayy } from "@/lib/presswayy.functions";

function PresswayyCardContent() {
  const [key, setKey] = useState("");
  const [active, setActive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [busy, setBusy] = useState<"save" | "register" | "test" | "sync" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const statusFn = useServerFn(getPresswayyStatus);
  const saveFn = useServerFn(savePresswayy);
  const registerFn = useServerFn(registerPresswayy);
  const testFn = useServerFn(testPresswayy);
  const syncFn = useServerFn(resyncPresswayy);

  useEffect(() => {
    statusFn().then((r) => { setConnected(r.connected); setActive(r.active); setKeyId(r.key_id); }).catch(() => undefined);
  }, [statusFn]);

  const save = async () => {
    if (!key.trim()) return toast.error("Presswayy connection key দিন");
    setBusy("save");
    try {
      const r = await saveFn({ data: { connection_key: key.trim(), store_url: "https://oronnonogor.com", inbound_base: "/presswayy/v1", platform: "tanstack", framework: "custom" } });
      setConnected(true); setActive(true); setKeyId(r.key_id); setKey("");
      toast.success("Presswayy configuration সেভ হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "সেভ ব্যর্থ"); }
    finally { setBusy(null); }
  };

  const run = async (kind: "register" | "test" | "sync") => {
    setBusy(kind);
    try {
      if (kind === "register") { await registerFn(); toast.success("Presswayy store register সফল"); }
      if (kind === "test") { await testFn(); toast.success("Presswayy connection ঠিক আছে"); }
      if (kind === "sync") { const r = await syncFn(); toast.success(`${r.products}টি product Presswayy-তে sync হয়েছে`); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "অপারেশন ব্যর্থ"); }
    finally { setBusy(null); }
  };

  if (!expanded) {
    return <button type="button" onClick={() => setExpanded(true)} className="group w-full rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/70 p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand/20">
      <div className="mb-6 flex items-start justify-between"><div className="rounded-2xl bg-white/90 p-3 shadow-sm transition-transform duration-300 group-hover:scale-110"><Link2 className="h-5 w-5 text-brand" /></div><span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">{connected && active ? "Connected" : "Not connected"}</span></div>
      <h2 className="font-bold text-slate-900">Presswayy AI — Store Sync</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">AI order ও product stock sync-এর secure connection</p>
      <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-brand">বিস্তারিত দেখুন <Link2 className="h-3 w-3" /></div>
    </button>;
  }

  return <div className="lg:col-span-3 animate-in fade-in slide-in-from-right-3 duration-300 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <button type="button" onClick={() => setExpanded(false)} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-x-0.5 hover:shadow-md"><ArrowLeft className="h-4 w-4" />API তালিকায় ফিরে যান</button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><div className="rounded-xl bg-brand/10 p-2.5"><Link2 className="h-5 w-5 text-brand" /></div><h2 className="text-lg font-bold">Presswayy AI — Store Sync</h2>{connected && active ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"><CheckCircle2 className="h-3 w-3" /> Connected</span> : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"><XCircle className="h-3 w-3" /> Not connected</span>}</div><p className="mt-1 text-xs text-muted-foreground">Presswayy AI-কে product catalog জানাতে এবং AI order/stock sync চালাতে secure two-way connection।</p></div></div>
    <div className="mt-4 grid gap-3"><div><label className="text-xs font-semibold text-muted-foreground">Connection Key</label><input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={keyId ? `Connected key: ${keyId} • নতুন key দিলে replace হবে` : "id.secret"} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-mono" /><p className="mt-1 text-[11px] text-muted-foreground">Key browser-এ দেখানো বা source code-এ রাখা হয় না; server-side encrypted secret storage ব্যবহার করুন।</p></div><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border bg-slate-50 p-3"><div className="text-[11px] text-muted-foreground">Store</div><div className="text-sm font-semibold">oronnonogor.com</div></div><div className="rounded-xl border bg-slate-50 p-3"><div className="text-[11px] text-muted-foreground">Inbound API</div><div className="text-sm font-semibold break-all">/presswayy/v1</div></div></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={save} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50"><Save className="h-4 w-4" />{busy === "save" ? "সেভ হচ্ছে..." : "Save Key"}</button><button onClick={() => run("register")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Link2 className="h-4 w-4" />{busy === "register" ? "Connecting..." : "Register Store"}</button><button onClick={() => run("test")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Test</button><button onClick={() => run("sync")} disabled={!connected || !!busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sync Products</button></div>
  </div>;
}

export function PresswayyCard() {
  const loc = useLocation();
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    if (loc.pathname !== "/admin/all-api") { setTarget(null); return; }
    const find = () => document.querySelector('div[class*="lg:grid-cols-3"]');
    const el = find();
    if (el) setTarget(el);
    else { const timer = window.setTimeout(() => setTarget(find()), 0); return () => window.clearTimeout(timer); }
  }, [loc.pathname]);
  const content = <PresswayyCardContent />;
  return loc.pathname === "/admin/all-api" && target ? createPortal(content, target) : loc.pathname === "/admin/all-api" ? null : content;
}
