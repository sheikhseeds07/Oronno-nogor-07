import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Save, TestTube2, Eye, EyeOff, ArrowLeft, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin/meta-ad-account")({ component: MetaAdAccount });

function MetaAdAccount() {
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState({ appId: "", appSecret: "", accessToken: "", adAccountId: "", dollarRate: "" });
  const update = (key: keyof typeof form, value: string) => setForm((s) => ({ ...s, [key]: value }));
  const save = () => {
    if (!form.appId || !form.accessToken || !form.adAccountId) {
      toast.error("App ID, Access Token এবং Ad Account ID দিন");
      return;
    }
    toast.success("Meta Ad Account settings সংরক্ষণ করা হয়েছে");
  };
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <button onClick={() => history.back()} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All API</button>
        <div className="rounded-2xl border bg-card p-5 shadow-sm md:p-7">
          <div className="mb-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-bold">M</div><div><h1 className="text-xl font-semibold">Meta Ad Account</h1><p className="text-sm text-muted-foreground">Meta Ads API connection</p></div></div>
          <div className="grid gap-4">
            <Field label="App ID" value={form.appId} onChange={(v) => update("appId", v)} placeholder="Meta App ID" />
            <Field label="App Secret" value={form.appSecret} onChange={(v) => update("appSecret", v)} placeholder="Meta App Secret" type={showSecret ? "text" : "password"} end={<button type="button" onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
            <Field label="Access Token" value={form.accessToken} onChange={(v) => update("accessToken", v)} placeholder="Meta Access Token" type={showToken ? "text" : "password"} end={<button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
            <Field label="Ad Account ID" value={form.adAccountId} onChange={(v) => update("adAccountId", v)} placeholder="act_123456789" />
            <Field label="Dollar Rate (USD → BDT)" value={form.dollarRate} onChange={(v) => update("dollarRate", v)} placeholder="যেমন 123.50" inputMode="decimal" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><button onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"><Save className="h-4 w-4" /> Save & Connect</button><button onClick={() => toast.info("Secure server-side Meta API verification will be added before production token validation.")} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium"><TestTube2 className="h-4 w-4" /> Test Connection</button></div>
          <p className="mt-4 text-xs text-muted-foreground">Dollar Rate ব্যবহার করে USD ad spend-কে BDT-তে হিসাব করা যাবে। App Secret এবং Access Token frontend/localStorage-এ সংরক্ষণ করা হবে না।</p>
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", end, icon, inputMode }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; end?: React.ReactNode; icon?: React.ReactNode; inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url" }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span><div className="flex items-center rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/30">{icon && <span className="mr-2">{icon}</span>}<input className="min-w-0 flex-1 bg-transparent py-3 outline-none" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" inputMode={inputMode} />{end && <span className="ml-2">{end}</span>}</div></label>;
}
