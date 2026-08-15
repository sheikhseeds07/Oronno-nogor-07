import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, TestTube2, Eye, EyeOff, ArrowLeft, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";

export const Route = createFileRoute("/admin/meta-ad-account")({ component: MetaAdAccount });

const SETTINGS_KEY = "meta_ad_account";

type Form = { appId: string; appSecret: string; accessToken: string; adAccountId: string; dollarRate: string };
const emptyForm: Form = { appId: "", appSecret: "", accessToken: "", adAccountId: "", dollarRate: "" };

function MetaAdAccount() {
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const update = (key: keyof Form, value: string) => setForm((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("integrations").select("config").eq("key", SETTINGS_KEY).maybeSingle();
      if (!active || !data?.config) return;
      const c = data.config as Record<string, unknown>;
      setForm({
        appId: String(c.appId ?? ""),
        appSecret: String(c.appSecret ?? ""),
        accessToken: String(c.accessToken ?? ""),
        adAccountId: String(c.adAccountId ?? ""),
        dollarRate: String(c.dollarRate ?? ""),
      });
    })();
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (!form.appId || !form.accessToken || !form.adAccountId) {
      toast.error("App ID, Access Token এবং Ad Account ID দিন");
      return;
    }
    const rate = Number(form.dollarRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("সঠিক Dollar Rate দিন, যেমন 123.50");
      return;
    }
    setSaving(true);
    try {
      const payload = { key: SETTINGS_KEY, config: form };
      const { error } = await supabase.from("integrations").upsert(payload, { onConflict: "key" });
      if (error) throw error;
      toast.success("Meta Ad Account ও Dollar Rate সংরক্ষণ হয়েছে");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "সংরক্ষণ করা যায়নি");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <button onClick={() => history.back()} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All API</button>
        <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
          <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">M</div><div><h1 className="text-xl font-semibold">Meta Ad Account</h1><p className="text-sm text-muted-foreground">Meta Ads connection ও business cost settings</p></div></div>
          <div className="grid gap-4">
            <Field label="App ID" value={form.appId} onChange={(v) => update("appId", v)} placeholder="Meta App ID" />
            <Field label="App Secret" value={form.appSecret} onChange={(v) => update("appSecret", v)} placeholder="Meta App Secret" type={showSecret ? "text" : "password"} end={<button type="button" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
            <Field label="Access Token" value={form.accessToken} onChange={(v) => update("accessToken", v)} placeholder="Meta Access Token" type={showToken ? "text" : "password"} end={<button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
            <Field label="Ad Account ID" value={form.adAccountId} onChange={(v) => update("adAccountId", v)} placeholder="act_123456789" />
            <Field label="Dollar Rate (USD → BDT)" value={form.dollarRate} onChange={(v) => update("dollarRate", v)} placeholder="যেমন 123.50" inputMode="decimal" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save & Connect"}</button><button onClick={() => toast.info("Meta Graph API verification requires a secure server-side token check.")} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium"><TestTube2 className="h-4 w-4" /> Test Connection</button></div>
          <p className="mt-4 text-xs text-muted-foreground">Dollar Rate এখানে একবার সেট করলে ABR Business Overview-তে USD ad spend → BDT খরচ হিসাবের ভিত্তি হিসেবে ব্যবহার করা যাবে।</p>
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", end, icon, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; end?: React.ReactNode; icon?: React.ReactNode; inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url" }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><div className="flex items-center rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/30">{icon && <span className="mr-2">{icon}</span>}<input className="min-w-0 flex-1 bg-transparent py-3 outline-none" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" inputMode={inputMode} />{end && <span className="ml-2">{end}</span>}</div></label>;
}
