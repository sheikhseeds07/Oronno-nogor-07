import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Check, LayoutTemplate, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/landing-template")({ component: LandingTemplateAdmin });

type Row = { id: string; slug: string; title: string; is_published?: boolean; planting_steps?: unknown };

function LandingTemplateAdmin() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-landing-template-selector"],
    queryFn: async () => (await supabase.from("landing_pages").select("id,slug,title,is_published,planting_steps").order("created_at", { ascending: false }).limit(100)).data as Row[] ?? [],
  });

  const getTemplate = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return "combo";
    const value = raw as { template?: string };
    return value.template || "combo";
  };

  const setTemplate = async (row: Row, template: "product" | "premium" | "modern" | "combo" | "all-product") => {
    setBusy(row.id);
    const current = row.planting_steps && typeof row.planting_steps === "object" ? row.planting_steps as Record<string, unknown> : {};
    const { error } = await supabase.from("landing_pages").update({ planting_steps: { ...current, template } }).eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("Landing template পরিবর্তন হয়েছে"); qc.invalidateQueries({ queryKey: ["admin-landing-template-selector"] }); }
    setBusy(null);
  };

  return <AdminLayout>
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="rounded-3xl bg-white border p-5 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-emerald-50 grid place-items-center text-emerald-700"><LayoutTemplate className="w-5 h-5"/></span><div><h1 className="text-2xl font-black">Landing Page Template</h1><p className="text-sm text-slate-500 mt-1">HN Garden-এর মতো product-first sales layout আপনার যেকোনো landing page-এ চালু করুন।</p></div></div>
      </div>
      {isLoading ? <div className="p-8 text-center">লোড হচ্ছে...</div> : <div className="grid md:grid-cols-2 gap-4">{data?.map(row => { const active = getTemplate(row.planting_steps); return <div key={row.id} className="rounded-3xl bg-white border p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-black text-lg">{row.title}</div><div className="text-xs text-slate-500 mt-1">/landing/{row.slug}</div></div>{row.is_published && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700">Published</span>}</div><div className="grid grid-cols-2 gap-2 mt-4">{([ ["product", "Product Style", "HN Garden-এর মতো product detail + price + COD checkout"], ["premium", "Premium", "Premium hero + benefits + checkout"], ["modern", "Modern", "Modern conversion landing"], ["combo", "Combo", "বর্তমান combo/funnel template"], ["all-product", "All product", "লাইভ Karala landing page-এর হুবহু ডিজাইন ও ফিচার"] ] as const).map(([value, label, hint]) => <button key={value} type="button" disabled={busy === row.id} onClick={() => setTemplate(row, value)} className={`text-left rounded-2xl border-2 p-3 transition ${active === value ? "border-emerald-600 bg-emerald-50/70" : "border-slate-200 hover:border-slate-300"}`}><div className="flex items-center justify-between"><span className="font-black text-sm">{label}</span>{active === value && <Check className="w-4 h-4 text-emerald-700"/>}</div><div className="text-[11px] text-slate-500 mt-1 leading-4">{hint}</div></button>)}</div><a href={`/landing/${row.slug}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><ExternalLink className="w-4 h-4"/> Landing Page দেখুন</a></div>})}</div>}
    </div>
  </AdminLayout>;
}
