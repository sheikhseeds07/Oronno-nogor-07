import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { getGeminiSettings, saveGeminiSettings } from "@/lib/gemini-ai.functions";
import { toast } from "sonner";
import { ArrowLeft, Bot, CheckCircle2, KeyRound, Save, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/ai-settings")({ component: AiSettingsPage });

function AiSettingsPage() {
  const getSettings = useServerFn(getGeminiSettings);
  const saveSettings = useServerFn(saveGeminiSettings);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [configured, setConfigured] = useState(false);
  const [masked, setMasked] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSettings({}).then((r) => { setConfigured(r.configured); setMasked(r.maskedKey); setModel(r.model); }).catch((e) => toast.error(e instanceof Error ? e.message : "সেটিংস লোড হয়নি")).finally(() => setLoading(false)); }, []);

  const save = async () => {
    if (!apiKey.trim() && !configured) return toast.error("Gemini API key দিন");
    setSaving(true);
    try {
      const r = await saveSettings({ data: { api_key: apiKey.trim(), model } });
      setConfigured(r.configured); if (apiKey.trim()) setMasked(`${apiKey.trim().slice(0, 6)}••••••••${apiKey.trim().slice(-4)}`); setApiKey(""); toast.success("Gemini AI সেটিংস সংরক্ষণ হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "সংরক্ষণ হয়নি"); } finally { setSaving(false); }
  };

  return <AdminLayout><div className="mx-auto max-w-3xl space-y-5">
    <a href="/admin/settings" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm"><ArrowLeft className="h-4 w-4" />কন্টাক্ট সেটিংসে ফিরে যান</a>
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-slate-950 px-6 py-7 text-white"><div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" /><div className="relative flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-lime-300 text-slate-950 shadow-lg"><Bot className="h-7 w-7" /></div><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> AI Customer Care</div><h1 className="mt-1 text-2xl font-black">Gemini AI সেটিংস</h1><p className="mt-1 text-sm text-white/60">লাইভ চ্যাটের জন্য আপনার Gemini API ব্যবহার করুন।</p></div></div></div>
      <div className="space-y-5 p-6">
        {loading ? <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">সেটিংস লোড হচ্ছে...</div> : <>
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><CheckCircle2 className={`h-5 w-5 ${configured ? "text-emerald-600" : "text-amber-600"}`} /><div><p className="text-sm font-bold text-slate-900">{configured ? "Gemini API সংযুক্ত আছে" : "Gemini API এখনো সেট করা হয়নি"}</p>{configured && <p className="text-xs text-slate-500">{masked}</p>}</div></div>
          <div><label className="text-sm font-bold text-slate-700">Gemini API Key</label><div className="relative"><KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? "নতুন key দিতে চাইলে এখানে দিন" : "AIza..."} className="mt-1 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></div><p className="mt-1.5 text-xs text-slate-500">API key browser-এর public settings-এ রাখা হবে না; server-side secure table-এ রাখা হবে।</p></div>
          <div><label className="text-sm font-bold text-slate-700">Gemini Model</label><select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-emerald-400"><option value="gemini-2.5-flash">Gemini 2.5 Flash</option><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option></select></div>
          <button type="button" disabled={saving} onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "সংরক্ষণ হচ্ছে..." : "Gemini API সংরক্ষণ করুন"}</button>
        </>}
      </div>
    </div>
  </div></AdminLayout>;
}
