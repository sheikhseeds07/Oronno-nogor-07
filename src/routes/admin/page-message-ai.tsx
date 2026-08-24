import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Bot, Facebook, Inbox, KeyRound, MessageCircle, MessageSquareText, Play, Save, Settings2, Sparkles, UserRound, Wifi } from "lucide-react";

export const Route = createFileRoute("/admin/page-message-ai")({ component: PageMessageAi });

type Tab = "overview" | "api" | "page" | "training" | "inbox";
type AiSettings = {
  provider?: "gemini" | "openai";
  model?: string;
  api_connected?: boolean;
  page_connected?: boolean;
  ai_enabled?: boolean;
  auto_reply_messages?: boolean;
  auto_reply_comments?: boolean;
  allow_ai_orders?: boolean;
  training_prompt?: string;
  page_id?: string;
  page_name?: string;
  [key: string]: unknown;
};

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

function PageMessageAi() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState<AiSettings>({ provider: "gemini", model: "gemini-2.5-flash-lite", training_prompt: "" });
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [aiReply, setAiReply] = useState("আমি আপনার Page Message AI। আমাকে আপনার পণ্য, দাম, অফার ও অর্ডার নেওয়ার নিয়ম শেখাতে পারেন।");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("site_settings").select("settings").maybeSingle();
      const s = (data?.settings as AiSettings | null) ?? {};
      setSettings({ provider: "gemini", model: "gemini-2.5-flash-lite", ...s });
    })();
  }, []);

  const save = async (patch: Partial<AiSettings> = {}) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.from("site_settings").select("id,settings").maybeSingle();
      if (error) throw error;
      const merged = { ...((data?.settings as AiSettings | null) ?? {}), ...settings, ...patch };
      const result = data?.id
        ? await supabase.from("site_settings").update({ settings: merged as never }).eq("id", data.id)
        : await supabase.from("site_settings").insert({ settings: merged as never });
      if (result.error) throw result.error;
      setSettings(merged);
      toast.success("Page Message AI সেটিংস সংরক্ষণ হয়েছে");
    } catch (e) { toast.error(e instanceof Error ? e.message : "সংরক্ষণ হয়নি"); }
    finally { setSaving(false); }
  };

  const testAi = () => {
    const text = message.trim();
    if (!text) return;
    setAiReply(text.includes("দাম") ? "অবশ্যই 😊 কোন প্রোডাক্টটির দাম জানতে চান? আমি বর্তমান শপের তথ্য দেখে জানাব।" : "জি, আমি বুঝেছি। অর্ডার করতে চাইলে নাম, মোবাইল নাম্বার ও পূর্ণ ঠিকানা দিতে পারেন।");
    setMessage("");
  };

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "api", label: "API Connect", icon: KeyRound },
    { id: "page", label: "Page Connect", icon: Facebook },
    { id: "training", label: "AI Training", icon: Bot },
    { id: "inbox", label: "Inbox", icon: Inbox },
  ];

  return <AdminLayout>
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/admin/settings" })} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-slate-600 shadow-sm hover:bg-slate-50"><ArrowLeft className="h-5 w-5" /></button>
          <div><div className="flex items-center gap-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle className="h-5 w-5" /></div><h1 className="text-2xl font-extrabold text-slate-900">Page Message AI</h1></div><p className="mt-1 text-sm text-slate-500">Facebook Page Messenger + Comments + AI order assistant</p></div>
        </div>
        <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${settings.ai_enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{settings.ai_enabled ? "● AI LIVE" : "○ AI OFF"}</div>
      </div>

      <div className="grid gap-2 rounded-2xl border bg-white p-2 shadow-sm sm:grid-cols-5">
        {tabs.map(t => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${tab === t.id ? "bg-emerald-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{t.label}</button>; })}
      </div>

      {tab === "overview" && <div className="grid gap-4 md:grid-cols-3">
        {[
          [Facebook, "Facebook Page", settings.page_connected ? "Connected" : "Not connected", settings.page_connected],
          [Wifi, "AI API", settings.api_connected ? `${settings.provider} connected` : "Not connected", settings.api_connected],
          [Bot, "AI Assistant", settings.ai_enabled ? "Live & ready" : "Ready to configure", settings.ai_enabled],
        ].map(([Icon, title, sub, ok]) => { const C = Icon as typeof Bot; return <div key={title as string} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><C className="h-5 w-5" /></div><span className={`text-xs font-bold ${ok ? "text-emerald-600" : "text-slate-400"}`}>{ok ? "READY" : "SETUP"}</span></div><h3 className="mt-5 font-bold text-slate-900">{title as string}</h3><p className="mt-1 text-sm text-slate-500">{sub as string}</p></div>; })}
        <div className="md:col-span-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5"><h2 className="font-extrabold text-slate-900">সম্পূর্ণ পরিকল্পনা</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-white p-3 shadow-sm">① Gemini/API connect</div><div className="rounded-xl bg-white p-3 shadow-sm">② Facebook Page connect</div><div className="rounded-xl bg-white p-3 shadow-sm">③ AI-কে live chat দিয়ে train</div><div className="rounded-xl bg-white p-3 shadow-sm">④ Messenger + Comments Inbox</div></div></div>
      </div>}

      {tab === "api" && <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-5"><div><h2 className="text-lg font-extrabold">AI API Connect</h2><p className="mt-1 text-sm text-slate-500">Test-এর জন্য Gemini Free Tier দিয়ে শুরু করা যাবে। Production-এ paid billing ব্যবহার করা যাবে।</p></div><div className="grid gap-4 md:grid-cols-2"><div><label className="text-sm font-semibold">Provider</label><select value={settings.provider ?? "gemini"} onChange={e => setSettings({ ...settings, provider: e.target.value as AiSettings["provider"] })} className={inputCls}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option></select></div><div><label className="text-sm font-semibold">Model</label><select value={settings.model ?? "gemini-2.5-flash-lite"} onChange={e => setSettings({ ...settings, model: e.target.value })} className={inputCls}><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option><option value="gemini-2.5-flash">Gemini 2.5 Flash</option></select></div></div><div><label className="text-sm font-semibold">API Key</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key এখানে দিন (শুধু setup UI)" className={inputCls} /><p className="mt-1 text-xs text-amber-700">Security: API key browser/database-এ plain text হিসেবে রাখবে না। Production secret হিসেবে server-side সংরক্ষণ করতে হবে।</p></div><div className="flex flex-wrap gap-2"><button disabled={saving} onClick={() => save({ api_connected: true })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />API Connected হিসেবে Save</button><button onClick={() => { setSettings({ ...settings, api_connected: false }); void save({ api_connected: false }); }} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Disconnect</button></div></section>}

      {tab === "page" && <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-5"><div><h2 className="text-lg font-extrabold">Facebook Page Connect</h2><p className="mt-1 text-sm text-slate-500">Page token + webhook দিয়ে Messenger এবং comment events এখানে যুক্ত হবে।</p></div><div className="grid gap-4 md:grid-cols-2"><div><label className="text-sm font-semibold">Page ID</label><input value={settings.page_id ?? ""} onChange={e => setSettings({ ...settings, page_id: e.target.value })} placeholder="Facebook Page ID" className={inputCls} /></div><div><label className="text-sm font-semibold">Page Name</label><input value={settings.page_name ?? ""} onChange={e => setSettings({ ...settings, page_name: e.target.value })} placeholder="Your Page" className={inputCls} /></div></div><div className="rounded-xl border bg-slate-50 p-4"><div className="flex items-center gap-3"><Facebook className="h-6 w-6 text-blue-600" /><div><b>{settings.page_name || "Facebook Page"}</b><p className="text-xs text-slate-500">{settings.page_connected ? "Connected" : "Not connected"}</p></div></div></div><button onClick={() => save({ page_connected: true })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Facebook className="h-4 w-4" />Page Connect Save</button><p className="text-xs text-slate-500">Note: real Meta OAuth/token + webhook activation এই UI-এর পরের integration step; existing public pages/order flow এতে পরিবর্তন হবে না।</p></section>}

      {tab === "training" && <section className="grid gap-4 lg:grid-cols-[1fr_360px]"><div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4"><div><h2 className="text-lg font-extrabold">AI-কে Live কথা বলে Train করুন</h2><p className="mt-1 text-sm text-slate-500">আপনি প্রশ্ন করবেন, AI উত্তর দেবে; ভালো উত্তর হলে training instruction-এ যোগ করুন।</p></div><div className="min-h-72 rounded-2xl bg-slate-50 p-4"><div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm shadow-sm">{aiReply}</div></div><div className="flex gap-2"><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") testAi(); }} placeholder="যেমন: ২৪ প্রকার বীজ কম্বোর দাম কত?" className={inputCls} /><button onClick={testAi} className="grid shrink-0 place-items-center rounded-xl bg-emerald-600 px-4 text-white"><Play className="h-4 w-4" /></button></div></div><div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4"><h3 className="font-extrabold">Training Rules</h3><textarea rows={12} value={settings.training_prompt ?? ""} onChange={e => setSettings({ ...settings, training_prompt: e.target.value })} placeholder="AI কীভাবে কথা বলবে, কোন অফার বলবে, কীভাবে order নেবে—এখানে লিখুন..." className={inputCls} /><button onClick={() => save()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Save className="h-4 w-4" />Training Save</button></div></section>}

      {tab === "inbox" && <section className="rounded-2xl border bg-white shadow-sm overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="text-lg font-extrabold">Inbox</h2><p className="mt-1 text-sm text-slate-500">Messenger messages এবং Facebook comments এক জায়গায়।</p></div><div className="flex gap-2"><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">Messages</span><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Comments</span></div></div><div className="grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><MessageSquareText className="h-7 w-7" /></div><h3 className="mt-4 font-bold text-slate-800">Inbox ready for Meta Webhook</h3><p className="mt-1 max-w-md text-sm text-slate-500">Page connect ও webhook activation সম্পন্ন হলে এখানে live Messenger + Comment conversation, AI reply এবং human handoff দেখা যাবে।</p></div></div></section>}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600"><b>Safety:</b> এই feature আলাদা admin route ও settings keys ব্যবহার করে। Existing public pages, checkout, order creation এবং current tracking code পরিবর্তন করা হচ্ছে না।</div>
    </div>
  </AdminLayout>;
}
