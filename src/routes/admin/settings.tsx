import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type Settings = {
  site_name?: string; tagline?: string; phone?: string; email?: string; address?: string;
  whatsapp?: string; messenger?: string; facebook?: string;
  delivery_charge_inside?: number; delivery_charge_outside?: number; free_delivery_above?: number;
};

function SettingsPage() {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>({});
  const [id, setId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["site-settings-admin"],
    queryFn: async () => (await supabase.from("site_settings").select("*").maybeSingle()).data,
  });

  useEffect(() => {
    if (data) {
      setS((data.settings as Settings) ?? {});
      setId(data.id);
    }
  }, [data]);

  const save = async () => {
    if (id) {
      const { error } = await supabase.from("site_settings").update({ settings: s }).eq("id", id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("site_settings").insert({ settings: s });
      if (error) return toast.error(error.message);
    }
    toast.success("সংরক্ষণ হয়েছে");
    qc.invalidateQueries({ queryKey: ["site-settings-admin"] });
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">সেটিংস</h1>
      <div className="bg-white border rounded-xl p-5 max-w-2xl space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="text-sm font-medium">সাইট নাম</label><input value={s.site_name ?? ""} onChange={(e) => setS({ ...s, site_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">ট্যাগলাইন</label><input value={s.tagline ?? ""} onChange={(e) => setS({ ...s, tagline: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">ফোন</label><input value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">ইমেইল</label><input value={s.email ?? ""} onChange={(e) => setS({ ...s, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">WhatsApp (8801...)</label><input value={s.whatsapp ?? ""} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">Messenger লিংক</label><input value={s.messenger ?? ""} onChange={(e) => setS({ ...s, messenger: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">Facebook পেজ</label><input value={s.facebook ?? ""} onChange={(e) => setS({ ...s, facebook: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <div><label className="text-sm font-medium">ঠিকানা</label><textarea rows={2} value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><label className="text-sm font-medium">ঢাকার ভেতরে চার্জ (৳)</label><input type="number" value={s.delivery_charge_inside ?? 60} onChange={(e) => setS({ ...s, delivery_charge_inside: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">ঢাকার বাইরে চার্জ (৳)</label><input type="number" value={s.delivery_charge_outside ?? 130} onChange={(e) => setS({ ...s, delivery_charge_outside: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">ফ্রি ডেলিভারি (৳ এর বেশি)</label><input type="number" value={s.free_delivery_above ?? 1000} onChange={(e) => setS({ ...s, free_delivery_above: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <button onClick={save} className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold">সংরক্ষণ করুন</button>
      </div>
    </AdminLayout>
  );
}
