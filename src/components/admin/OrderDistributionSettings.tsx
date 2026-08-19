import { useEffect, useState } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { UsersRound, Save, RefreshCw } from "lucide-react";

export function OrderDistributionSettings() {
  const [enabled, setEnabled] = useState(false);
  const [includeIncomplete, setIncludeIncomplete] = useState(true);
  const [members, setMembers] = useState<Array<{ user_id: string; name: string; enabled: boolean; position: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: settings }, { data: rows }] = await Promise.all([
      supabase.from("site_settings").select("settings").maybeSingle(),
      supabase.from("order_distribution_members").select("user_id,name,enabled,position").order("position", { ascending: true }),
    ]);
    const s = (settings?.settings ?? {}) as Record<string, unknown>;
    setEnabled(s.order_distribution_enabled === true);
    setIncludeIncomplete(s.order_distribution_include_incomplete !== false);
    setMembers((rows ?? []) as typeof members);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

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
        const { error } = await supabase.from("order_distribution_members").update({ enabled: member.enabled, position: member.position }).eq("user_id", member.user_id);
        if (error) throw error;
      }
      toast.success("Order Division settings saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save settings"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Loading Order Division…</div>;
  return <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><UsersRound className="h-6 w-6" /></div><div><h2 className="text-lg font-bold text-slate-900">Order Division</h2><p className="text-xs text-slate-500 mt-1">Processing orders are distributed 1 → 2 → 3 → 1 using a safe round-robin queue.</p></div></div>
      <button type="button" onClick={() => void load()} className="rounded-lg border p-2 text-slate-500 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /></button>
    </div>
    <label className="flex items-center justify-between rounded-xl border bg-slate-50 p-4"><span><b className="text-sm">Enable Order Division</b><span className="block text-xs text-slate-500 mt-1">New Processing orders are assigned automatically.</span></span><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-5 w-5" /></label>
    <label className="flex items-center justify-between rounded-xl border p-4"><span><b className="text-sm">Include Incomplete → Processing</b><span className="block text-xs text-slate-500 mt-1">When an incomplete order becomes Processing, it joins the same queue.</span></span><input type="checkbox" checked={includeIncomplete} onChange={e => setIncludeIncomplete(e.target.checked)} className="h-5 w-5" /></label>
    <div><h3 className="text-sm font-bold mb-2">Active assignment order</h3><div className="space-y-2">{members.map((m, i) => <label key={m.user_id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={m.enabled} onChange={e => setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, enabled: e.target.checked } : x))} className="h-4 w-4"/><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i + 1}</span><span className="font-semibold text-sm">{m.name}</span></label>)}</div></div>
    <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save Order Division"}</button>
  </div>;
}
