import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { UsersRound, Save, RefreshCw, Activity } from "lucide-react";
import { getOrderAssignmentCounts } from "@/lib/order-distribution.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

type Member = { user_id: string; name: string; enabled: boolean; position: number };

export function OrderDistributionSettings() {
  const [enabled, setEnabled] = useState(false);
  const [includeIncomplete, setIncludeIncomplete] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const getCountsFn = useServerFn(getOrderAssignmentCounts);

  const load = async () => {
    setLoading(true);
    const [{ data: settings }, { data: rows }, { data: employees }] = await Promise.all([
      supabase.from("site_settings").select("settings").maybeSingle(),
      supabase.from("order_distribution_members").select("user_id,name,enabled,position").order("position", { ascending: true }),
      supabase.from("employees").select("user_id,name,is_active").eq("is_active", true).not("user_id", "is", null).order("name"),
    ]);
    const s = (settings?.settings ?? {}) as Record<string, unknown>;
    setEnabled(s.order_distribution_enabled === true);
    setIncludeIncomplete(s.order_distribution_include_incomplete !== false);
    if ((rows ?? []).length) setMembers(rows as Member[]);
    else {
      const initial = (employees ?? []).filter(e => e.user_id).map((e, i) => ({ user_id: e.user_id as string, name: e.name, enabled: true, position: i }));
      if (initial.length) {
        await supabase.from("order_distribution_members").upsert(initial);
        setMembers(initial);
      } else setMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const countInput = useMemo(() => ({ members }), [members]);
  const { data: orderCounts = {}, isFetching: countsFetching, refetch: refreshCounts } = useQuery({
    queryKey: ["order-assignment-live-counts", members.map(m => `${m.user_id}:${m.enabled}`).join(",")],
    queryFn: () => getCountsFn({ data: countInput }),
    enabled: members.length > 0,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const save = async () => {
    setSaving(true);
    try {
      const { data: current } = await supabase.from("site_settings").select("id,settings").maybeSingle();
      const settings = { ...((current?.settings ?? {}) as Record<string, unknown>), order_distribution_enabled: enabled, order_distribution_include_incomplete: includeIncomplete };
      const result = current?.id
        ? await supabase.from("site_settings").update({ settings: settings as never }).eq("id", current.id)
        : await supabase.from("site_settings").insert({ settings: settings as never });
      if (result.error) throw result.error;
      for (const member of members) {
        const { error } = await supabase.from("order_distribution_members").update({ enabled: member.enabled, position: member.position, updated_at: new Date().toISOString() }).eq("user_id", member.user_id);
        if (error) throw error;
      }
      toast.success("Order Division settings saved");
      void refreshCounts();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save settings"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Loading Order Division…</div>;
  return <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><UsersRound className="h-6 w-6" /></div><div><h2 className="text-lg font-bold text-slate-900">Order Division</h2><p className="text-xs text-slate-500 mt-1">Processing orders are distributed 1 → 2 → 3 → 1 using a safe round-robin queue.</p></div></div>
      <button type="button" onClick={() => { void load(); void refreshCounts(); }} className="rounded-lg border p-2 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
    </div>
    <label className="flex items-center justify-between rounded-xl border bg-slate-50 p-4"><span><b className="text-sm">Enable Order Division</b><span className="block text-xs text-slate-500 mt-1">New Processing orders are assigned automatically.</span></span><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-5 w-5" /></label>
    <label className="flex items-center justify-between rounded-xl border p-4"><span><b className="text-sm">Include Incomplete → Processing</b><span className="block text-xs text-slate-500 mt-1">When an incomplete order becomes Processing, it joins the same queue.</span></span><input type="checkbox" checked={includeIncomplete} onChange={e => setIncludeIncomplete(e.target.checked)} className="h-5 w-5" /></label>
    <div><div className="flex items-center justify-between mb-2"><h3 className="text-sm font-bold">Employees in round-robin queue</h3><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><Activity className="h-3.5 w-3.5" />Live</span></div><div className="space-y-2">{members.map((m, i) => <div key={m.user_id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={m.enabled} onChange={e => setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, enabled: e.target.checked } : x))} className="h-4 w-4"/><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span><span className="font-semibold text-sm flex-1">{m.name}</span><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{orderCounts[m.user_id] ?? 0} orders</span></div>)}</div>{!members.length && <p className="text-xs text-amber-700 mt-2">No active employees with a linked user account were found.</p>}<p className="text-[11px] text-slate-400 mt-2">Live count updates automatically every 2 seconds. Completed, delivered, cancelled and returned orders are not included.{countsFetching && " Updating…"}</p></div>
    <button type="button" disabled={saving || !members.length} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save Order Division"}</button>
  </div>;
}
