import { createFileRoute } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Save, CheckCircle2, XCircle, Plug, Loader2, Layers, Truck, Wallet, RefreshCw, MessageSquare, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { fetchCourierHistory } from "@/lib/courier-history.functions";
import { testCourierConnection, fetchSteadfastBalance } from "@/lib/courier-test.functions";
import { sendPhoneOtp } from "@/lib/phone-otp.functions";

export const Route = createFileRoute("/admin/all-api")({ component: AllApi });

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

type FbConfig = { pixel_id: string; test_event_code: string; access_token: string; enabled: boolean };
const emptyFb: FbConfig = { pixel_id: "", test_event_code: "", access_token: "", enabled: false };

type HoorinCfg = { endpoint: string; api_key: string };
const emptyHoorin: HoorinCfg = { endpoint: "https://dash.hoorin.com/api/courier/api", api_key: "" };

type SteadfastCfg = { api_key: string; secret_key: string; base_url: string };
const emptySteadfast: SteadfastCfg = { api_key: "", secret_key: "", base_url: "https://portal.packzy.com/api/v1" };

type SmsCfg = { url_template: string; api_key: string };
const emptySms: SmsCfg = {
  url_template: "https://dash.hoorin.com/api/sms/send?apiKey={api_key}&phone={phone}&message={message}",
  api_key: "",
};

const SF_ROW_NAME: Record<1 | 2, string> = { 1: "all_api_steadfast", 2: "all_api_steadfast_2" };

// One self-contained Steadfast account card (Courier 1 / Courier 2)
function SteadfastCard({ account }: { account: 1 | 2 }) {
  const rowName = SF_ROW_NAME[account];
  const [cfg, setCfg] = useState<SteadfastCfg>(emptySteadfast);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [balLoading, setBalLoading] = useState(false);

  const testFn = useServerFn(testCourierConnection);
  const balanceFn = useServerFn(fetchSteadfastBalance);

  useEffect(() => {
    (async () => {
      let { data: row } = await supabase.from("integrations").select("*").eq("name", rowName).maybeSingle();
      if (!row && account === 1) {
        const legacy = await supabase.from("integrations").select("*").eq("name", "courier_steadfast").maybeSingle();
        row = legacy.data;
      }
      if (row) {
        setActive(row.is_active);
        setCfg({ ...emptySteadfast, ...((row.config as Partial<SteadfastCfg>) || {}) });
      }
      setLoading(false);
    })();
  }, [rowName, account]);

  const trimmed = { api_key: cfg.api_key.trim(), secret_key: cfg.secret_key.trim(), base_url: cfg.base_url.trim() };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("integrations")
      .upsert({ name: rowName, is_active: active, config: trimmed, updated_at: new Date().toISOString() }, { onConflict: "name" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`Steadfast ${account} সেভ হয়েছে`);
  };

  const test = async () => {
    setTesting(true); setTestMsg(null); setTestOk(null);
    try {
      const r = await testFn({ data: { courier: "steadfast", config: trimmed } });
      setTestOk(r.success); setTestMsg(r.message);
      if (r.success) toast.success(r.message); else toast.error(r.message);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Test failed";
      setTestOk(false); setTestMsg(m); toast.error(m);
    } finally { setTesting(false); }
  };

  const checkBalance = async () => {
    setBalLoading(true);
    try {
      await save();
      const r = await balanceFn({ data: { account } });
      if (r.ok) { setBalance(r.balance); toast.success(`ব্যালেন্স: ৳${r.balance ?? "?"}`); }
      else { setBalance(null); toast.error(r.message); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBalLoading(false); }
  };

  if (loading) return <div className="rounded-xl border bg-white p-5 shadow-sm"><BrandLoader /></div>;

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand" />
          <h2 className="font-bold text-lg">Steadfast Courier {account}</h2>
          {active ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
          Enable
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">API Key</label>
          <input value={cfg.api_key} onChange={(e) => setCfg({ ...cfg, api_key: e.target.value })} placeholder="ci3w6..." className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Secret Key</label>
          <input type="password" value={cfg.secret_key} onChange={(e) => setCfg({ ...cfg, secret_key: e.target.value })} placeholder="j8rcp..." className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Base URL</label>
          <input value={cfg.base_url} onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold">বর্তমান ব্যালেন্স:</span>
          <span className="text-sm font-bold text-brand-dark">{balance !== null ? `৳ ${balance.toLocaleString()}` : "—"}</span>
        </div>
        <button onClick={checkBalance} disabled={balLoading} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 bg-white">
          {balLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          চেক করুন
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          {testMsg ? (
            testOk ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> {testMsg}</span>
                   : <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded-md"><XCircle className="w-3.5 h-3.5" /> {testMsg}</span>
          ) : <span className="text-muted-foreground">কানেকশন টেস্ট করা হয়নি</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={test} disabled={testing} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
            {testing ? "টেস্ট হচ্ছে..." : "Test Connection"}
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllApi() {
  // ----- Facebook -----
  const [fb, setFb] = useState<FbConfig>(emptyFb);
  const [allSettings, setAllSettings] = useState<Record<string, unknown>>({});
  const [rowId, setRowId] = useState<string | null>(null);

  // ----- Hoorin Courier Check -----
  const [hoorin, setHoorin] = useState<HoorinCfg>(emptyHoorin);
  const [hoorinActive, setHoorinActive] = useState(false);
  const [hTesting, setHTesting] = useState(false);
  const [hResult, setHResult] = useState<string | null>(null);
  const [hOk, setHOk] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingFb, setSavingFb] = useState(false);
  const [savingH, setSavingH] = useState(false);


  // ----- SMS (Hoorin) -----
  const [sms, setSms] = useState<SmsCfg>(emptySms);
  const [smsActive, setSmsActive] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsTestPhone, setSmsTestPhone] = useState("");
  const [smsResult, setSmsResult] = useState<string | null>(null);
  const [smsOk, setSmsOk] = useState<boolean | null>(null);

  const historyFn = useServerFn(fetchCourierHistory);
  const sendOtpFn = useServerFn(sendPhoneOtp);
  useEffect(() => {
    (async () => {
      const [{ data: ss }, { data: hRow }, { data: smsRow }, { data: fbRow }] = await Promise.all([
        supabase.from("site_settings").select("*").limit(1).maybeSingle(),
        supabase.from("integrations").select("*").eq("name", "all_api_hoorin").maybeSingle(),
        supabase.from("integrations").select("*").eq("name", "sms_hoorin").maybeSingle(),

        supabase.from("integrations").select("*").eq("name", "facebook_capi").maybeSingle(),
      ]);
      if (ss) {
        setRowId(ss.id);
        const s = (ss.settings as Record<string, unknown>) || {};
        setAllSettings(s);
        const sitePixel = ((s.facebook as { pixel_id?: string } | undefined)?.pixel_id) || "";
        const integ = (fbRow?.config as Partial<FbConfig> | undefined) || {};
        setFb({
          ...emptyFb,
          pixel_id: integ.pixel_id || sitePixel || "",
          access_token: integ.access_token || "",
          test_event_code: integ.test_event_code || "",
          enabled: fbRow?.is_active ?? true,
        });
      }
      if (hRow) {
        setHoorinActive(hRow.is_active);
        setHoorin({ ...emptyHoorin, ...((hRow.config as Partial<HoorinCfg>) || {}) });
      }

      if (smsRow) {
        setSmsActive(smsRow.is_active);
        setSms({ ...emptySms, ...((smsRow.config as Partial<SmsCfg>) || {}) });
      }
      setLoading(false);
    })();
  }, []);


  const saveSms = async () => {
    setSavingSms(true);
    const cfg = { url_template: sms.url_template.trim(), api_key: sms.api_key.trim() };
    const { error } = await supabase
      .from("integrations")
      .upsert({ name: "sms_hoorin", is_active: smsActive, config: cfg, updated_at: new Date().toISOString() }, { onConflict: "name" });
    setSavingSms(false);
    if (error) toast.error(error.message); else toast.success("SMS সেভ হয়েছে");
  };

  const testSms = async () => {
    if (!smsTestPhone.trim()) { toast.error("টেস্ট ফোন নাম্বার দিন"); return; }
    setSmsTesting(true); setSmsResult(null); setSmsOk(null);
    try {
      await saveSms();
      const r = await sendOtpFn({ data: { phone: smsTestPhone.trim() } });
      if (r.ok && r.sent) { setSmsOk(true); setSmsResult("OTP পাঠানো হয়েছে — ফোন চেক করুন"); toast.success("SMS পাঠানো হয়েছে"); }
      else { setSmsOk(false); setSmsResult(r.message || "ব্যর্থ"); toast.error(r.message || "ব্যর্থ"); }
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed";
      setSmsOk(false); setSmsResult(m); toast.error(m);
    } finally { setSmsTesting(false); }
  };

  const saveFb = async () => {
    setSavingFb(true);
    // Public site_settings keeps only the pixel_id (needed by the browser pixel).
    // The access_token + test_event_code go into the admin-only integrations row.
    const publicFacebook = { pixel_id: fb.pixel_id, enabled: fb.enabled };
    const next = { ...allSettings, facebook: publicFacebook };
    const payload = { settings: next, updated_at: new Date().toISOString() };
    const [siteRes, integRes] = await Promise.all([
      rowId
        ? supabase.from("site_settings").update(payload).eq("id", rowId)
        : supabase.from("site_settings").insert({ id: SETTINGS_ID, ...payload }),
      supabase.from("integrations").upsert(
        {
          name: "facebook_capi",
          is_active: fb.enabled,
          config: {
            pixel_id: fb.pixel_id,
            access_token: fb.access_token,
            test_event_code: fb.test_event_code,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "name" },
      ),
    ]);
    setSavingFb(false);
    const err = siteRes.error || integRes.error;
    if (err) toast.error(err.message);
    else { toast.success("Facebook সেভ হয়েছে"); setAllSettings(next); }
  };


  const saveHoorin = async () => {
    setSavingH(true);
    const cfg = { endpoint: hoorin.endpoint.trim(), api_key: hoorin.api_key.trim() };
    const { error } = await supabase
      .from("integrations")
      .upsert({ name: "all_api_hoorin", is_active: hoorinActive, config: cfg, updated_at: new Date().toISOString() }, { onConflict: "name" });
    setSavingH(false);
    if (error) toast.error(error.message); else toast.success("Hoorin সেভ হয়েছে");
  };

  const testHoorin = async () => {
    setHTesting(true); setHResult(null); setHOk(null);
    try {
      await saveHoorin();
      const r = await historyFn({ data: { phone: "01700000000" } });
      if (r.error) { setHOk(false); setHResult(`ব্যর্থ: ${r.error}`); toast.error(r.error); }
      else { setHOk(true); setHResult(`সফল — ${r.stats.length} কুরিয়ার রেসপন্স পাওয়া গেছে`); toast.success("কানেকশন সফল"); }
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed";
      setHOk(false); setHResult(m); toast.error(m);
    } finally { setHTesting(false); }
  };




  return (
    <AdminLayout>
      <div className="flex items-center gap-2 mb-1"><Layers className="w-6 h-6 text-brand" /><h1 className="text-2xl font-bold">All API</h1></div>
      <p className="text-sm text-muted-foreground mb-6">সব 3rd-party API এক জায়গায় — Steadfast, Hoorin, Facebook ইত্যাদি।</p>

      {loading ? <BrandLoader /> : (
        <div className="grid gap-5 max-w-3xl">
          {/* Steadfast — two accounts */}
          <SteadfastCard account={1} />
          <SteadfastCard account={2} />


          {/* Hoorin */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">Hoorin (Courier History — Steadfast / Pathao / RedX / Paperfly)</h2>
                {hoorinActive ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={hoorinActive} onChange={(e) => setHoorinActive(e.target.checked)} className="w-4 h-4" />
                Enable
              </label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">কানেক্ট থাকলে অর্ডার ওপেন করলে কাস্টমারের ফোন দিয়ে প্রতিটা কুরিয়ারে কত পার্সেল গেছে / ক্যানসেল হয়েছে — সব দেখাবে। (dash.hoorin.com থেকে API Key নিন)</p>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Endpoint</label>
                <input value={hoorin.endpoint} onChange={(e) => setHoorin({ ...hoorin, endpoint: e.target.value })} className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                <input type="password" value={hoorin.api_key} onChange={(e) => setHoorin({ ...hoorin, api_key: e.target.value })} placeholder="Hoorin API Key" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                {hResult ? (
                  hOk ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> {hResult}</span>
                       : <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded-md"><XCircle className="w-3.5 h-3.5" /> {hResult}</span>
                ) : <span className="text-muted-foreground">কানেকশন টেস্ট করা হয়নি</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={testHoorin} disabled={hTesting} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                  {hTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  {hTesting ? "টেস্ট হচ্ছে..." : "Test Connection"}
                </button>
                <button onClick={saveHoorin} disabled={savingH} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <Save className="w-4 h-4" /> {savingH ? "সেভ হচ্ছে..." : "সেভ করুন"}
                </button>
              </div>
            </div>
          </div>

          {/* SMS (Hoorin) */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand" />
                <h2 className="font-bold text-lg">SMS Provider (Hoorin)</h2>
                {smsActive ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={smsActive} onChange={(e) => setSmsActive(e.target.checked)} className="w-4 h-4" />
                Enable
              </label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Quick Login OTP এর জন্য Hoorin SMS API। URL টেমপ্লেটে এই placeholder গুলো ব্যবহার করুন:
              <code className="mx-1 px-1 rounded bg-muted">{"{api_key}"}</code>
              <code className="mx-1 px-1 rounded bg-muted">{"{phone}"}</code>
              <code className="mx-1 px-1 rounded bg-muted">{"{message}"}</code>
              <code className="mx-1 px-1 rounded bg-muted">{"{code}"}</code>
            </p>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL Template</label>
                <input value={sms.url_template} onChange={(e) => setSms({ ...sms, url_template: e.target.value })} className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Key</label>
                <input type="password" value={sms.api_key} onChange={(e) => setSms({ ...sms, api_key: e.target.value })} placeholder="Hoorin SMS API Key" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">টেস্ট ফোন (4-সংখ্যার OTP যাবে)</label>
                <input value={smsTestPhone} onChange={(e) => setSmsTestPhone(e.target.value)} placeholder="01XXXXXXXXX" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                {smsResult ? (
                  smsOk ? <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" /> {smsResult}</span>
                       : <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-1 rounded-md"><XCircle className="w-3.5 h-3.5" /> {smsResult}</span>
                ) : <span className="text-muted-foreground">এখনো টেস্ট SMS পাঠানো হয়নি</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={testSms} disabled={smsTesting} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                  {smsTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {smsTesting ? "পাঠানো হচ্ছে..." : "Test SMS"}
                </button>
                <button onClick={saveSms} disabled={savingSms} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <Save className="w-4 h-4" /> {savingSms ? "সেভ হচ্ছে..." : "সেভ করুন"}
                </button>
              </div>
            </div>
          </div>

          {/* Facebook */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">Facebook Pixel & Conversion API</h2>
                {fb.enabled ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={fb.enabled} onChange={(e) => setFb({ ...fb, enabled: e.target.checked })} className="w-4 h-4" />
                Enable
              </label>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Pixel ID</label>
                <input value={fb.pixel_id} onChange={(e) => setFb({ ...fb, pixel_id: e.target.value })} placeholder="1234567890123456" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Test Event Code</label>
                <input value={fb.test_event_code} onChange={(e) => setFb({ ...fb, test_event_code: e.target.value })} placeholder="TEST12345" className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Conversion API Access Token</label>
                <textarea value={fb.access_token} onChange={(e) => setFb({ ...fb, access_token: e.target.value })} rows={3} placeholder="EAAG..." className="w-full mt-1 rounded-lg border px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={saveFb} disabled={savingFb} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                <Save className="w-4 h-4" /> {savingFb ? "সেভ হচ্ছে..." : "সেভ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
