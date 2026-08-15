import { useEffect, useState } from "react";
import { Clock3, Globe2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrderRateLimitSettings, saveOrderRateLimitSettings } from "@/lib/order-rate-limit.functions";

const presets = [0, 15, 30, 60, 120, 360, 1440];

export function OrderRateLimitSettings() {
  const qc = useQueryClient();
  const getSettings = useServerFn(getOrderRateLimitSettings);
  const saveSettings = useServerFn(saveOrderRateLimitSettings);
  const { data, isLoading } = useQuery({ queryKey: ["order-rate-limit-settings"], queryFn: () => getSettings() });
  const [phone, setPhone] = useState(0);
  const [ip, setIp] = useState(0);
  useEffect(() => { if (data) { setPhone(data.phone_repeat_minutes); setIp(data.ip_repeat_minutes); } }, [data]);

  const mutation = useMutation({
    mutationFn: () => saveSettings({ data: { phone_repeat_minutes: phone, ip_repeat_minutes: ip } }),
    onSuccess: () => { toast.success("অর্ডার রিপিট লিমিট সংরক্ষণ হয়েছে"); qc.invalidateQueries({ queryKey: ["order-rate-limit-settings"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "সংরক্ষণ করা যায়নি"),
  });

  const Field = ({ type, value, setValue, icon: Icon, title, desc }: any) => (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-50 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="relative flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 shadow-inner"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-0.5 text-xs leading-5 text-slate-500">{desc}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{value === 0 ? "বন্ধ" : `${value} মিনিট`}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((p) => <button key={p} type="button" onClick={() => setValue(p)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${value === p ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"}`}>{p === 0 ? "বন্ধ" : p >= 1440 ? "২৪ ঘণ্টা" : `${p} মিনিট`}</button>)}
          </div>
          <div className="mt-3 flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" /><input type="number" min={0} max={10080} value={value} onChange={(e) => setValue(Math.max(0, Math.min(10080, Number(e.target.value) || 0)))} className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" /><span className="text-xs text-slate-500">মিনিট</span></div>
        </div>
      </div>
    </div>
  );

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />;
  return (
    <div className="mb-5 max-w-3xl overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white shadow-[0_20px_60px_-35px_rgba(5,150,105,.35)]">
      <div className="relative overflow-hidden border-b border-emerald-100 px-5 py-6 sm:px-6">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-200/20 blur-3xl" />
        <div className="relative flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"><ShieldCheck className="h-6 w-6" /></div><div><div className="flex items-center gap-2"><h2 className="text-xl font-extrabold tracking-tight text-slate-900">অর্ডার রিপিট লিমিট</h2><Sparkles className="h-4 w-4 text-amber-500" /></div><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">একই ফোন নম্বর বা IP থেকে অল্প সময়ের মধ্যে বারবার অর্ডার ঠেকাতে এখান থেকে সময় নির্ধারণ করুন। ০ দিলে সেই লিমিট বন্ধ থাকবে।</p></div></div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <Field value={phone} setValue={setPhone} icon={Phone} title="ফোন নম্বর লিমিট" desc="একই মোবাইল নম্বর থেকে নির্ধারিত সময়ের আগে নতুন অর্ডার বন্ধ থাকবে।" />
        <Field value={ip} setValue={setIp} icon={Globe2} title="IP লিমিট" desc="একই IP address থেকে নির্ধারিত সময়ের আগে নতুন অর্ডার বন্ধ থাকবে।" />
      </div>
      <div className="flex flex-col gap-3 border-t border-emerald-100 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-xs leading-5 text-slate-500">লিমিট server-side যাচাই হবে, তাই refresh বা browser change করেও সহজে bypass করা যাবে না।</p><button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="relative overflow-hidden rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{mutation.isPending ? "সংরক্ষণ হচ্ছে…" : "সেটিংস সংরক্ষণ করুন"}</button></div>
    </div>
  );
}
