import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Save, Sparkles, Bot } from "lucide-react";
import { toast } from "sonner";
import { getGeminiSettings, saveGeminiSettings } from "@/lib/gemini-ai.functions";

export function GeminiContactSettings() {
  const getSettings = useServerFn(getGeminiSettings);
  const saveSettings = useServerFn(saveGeminiSettings);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [configured, setConfigured] = useState(false);
  const [masked, setMasked] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings({})
      .then((r) => {
        setConfigured(r.configured);
        setMasked(r.maskedKey);
        setModel(r.model);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "AI সেটিংস লোড হয়নি"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!apiKey.trim() && !configured) return toast.error("Gemini API key দিন");
    setSaving(true);
    try {
      const r = await saveSettings({ data: { api_key: apiKey.trim(), model } });
      setConfigured(r.configured);
      if (apiKey.trim()) setMasked(`${apiKey.trim().slice(0, 6)}••••••••${apiKey.trim().slice(-4)}`);
      setApiKey("");
      toast.success("Gemini AI সেটিংস সংরক্ষণ হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI সেটিংস সংরক্ষণ হয়নি");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900">লাইভ চ্যাট — Gemini AI</h3>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">কাস্টমারের প্রশ্নের উত্তর ও অর্ডার নেওয়ার জন্য Live Chat AI চালু করুন।</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">AI সেটিংস লোড হচ্ছে...</div>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-xl border p-3 ${configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <CheckCircle2 className={`h-5 w-5 ${configured ? "text-emerald-600" : "text-amber-600"}`} />
            <div>
              <p className="text-sm font-bold text-slate-900">{configured ? "Gemini API সংযুক্ত আছে" : "Gemini API এখনো সেট করা হয়নি"}</p>
              {configured && <p className="text-xs text-slate-500">{masked}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">Gemini API Key</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? "নতুন key দিতে চাইলে এখানে দিন" : "AIza..."} className="mt-1 w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">API key শুধু server-side secure table-এ থাকবে; customer/browser-এর public settings-এ যাবে না।</p>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">Gemini Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-emerald-400">
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
            </select>
          </div>

          <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? "সংরক্ষণ হচ্ছে..." : "Gemini AI সংরক্ষণ করুন"}
          </button>
        </>
      )}
    </div>
  );
}
