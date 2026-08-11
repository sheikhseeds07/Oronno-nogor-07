import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/coupons")({ component: Coupons });

function Coupons() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", discount_type: "percent", discount_value: 10, min_order: 0, expires_at: "", is_active: true });

  const { data } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const save = async () => {
    if (!form.code) return toast.error("কুপন কোড দিন");
    const { error } = await supabase.from("coupons").insert({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_order: form.min_order,
      expires_at: form.expires_at || null,
      is_active: form.is_active,
    });
    if (error) return toast.error(error.message);
    toast.success("যোগ হয়েছে");
    setForm({ code: "", discount_type: "percent", discount_value: 10, min_order: 0, expires_at: "", is_active: true });
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">কুপন</h1>
      <div className="bg-white border rounded-xl p-4 mb-4 grid sm:grid-cols-3 gap-3">
        <input placeholder="কোড" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="border rounded-lg px-3 py-2" />
        <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="border rounded-lg px-3 py-2">
          <option value="percent">পার্সেন্ট %</option>
          <option value="fixed">ফিক্সড টাকা</option>
        </select>
        <input type="number" placeholder="ভ্যালু" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: +e.target.value })} className="border rounded-lg px-3 py-2" />
        <input type="number" placeholder="মিনিমাম অর্ডার" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: +e.target.value })} className="border rounded-lg px-3 py-2" />
        <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="border rounded-lg px-3 py-2" />
        <button onClick={save} className="bg-brand text-white rounded-lg font-semibold flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> যোগ করুন</button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="p-3 text-left">কোড</th><th className="p-3">টাইপ</th><th className="p-3">ভ্যালু</th><th className="p-3">মিন অর্ডার</th><th className="p-3">এক্সপায়ার</th><th className="p-3"></th></tr></thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono font-bold">{c.code}</td>
                <td className="p-3 text-center">{c.discount_type}</td>
                <td className="p-3 text-center">{c.discount_value}</td>
                <td className="p-3 text-center">{c.min_order}</td>
                <td className="p-3 text-center text-xs">{c.expires_at ?? "—"}</td>
                <td className="p-3 text-right"><button onClick={() => remove(c.id)} className="text-destructive p-2"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
