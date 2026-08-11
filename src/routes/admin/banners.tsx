import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

export const Route = createFileRoute("/admin/banners")({ component: Banners });

function Banners() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", image_url: "", link_url: "", display_order: 0 });

  const { data } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("display_order")).data ?? [],
  });

  const upload = async (file: File) => {
    try {
      const url = await uploadToBucket("banners", safeFileName(file.name), file);
      setForm({ ...form, image_url: url });
    } catch (e) { toast.error(e instanceof Error ? e.message : "আপলোড হয়নি"); }
  };

  const save = async () => {
    if (!form.image_url) return toast.error("ব্যানার ইমেজ আপলোড করুন");
    const { error } = await supabase.from("banners").insert({ ...form, is_active: true });
    if (error) return toast.error(error.message);
    toast.success("যোগ হয়েছে");
    setAdding(false); setForm({ title: "", image_url: "", link_url: "", display_order: 0 });
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const toggle = async (id: string, val: boolean) => {
    await supabase.from("banners").update({ is_active: val }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    await supabase.from("banners").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ব্যানার</h1>
        <button onClick={() => setAdding(true)} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন</button>
      </div>

      {adding && (
        <div className="bg-white border rounded-xl p-4 mb-4 space-y-3">
          <input placeholder="টাইটেল" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="লিংক URL (ঐচ্ছিক)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input type="number" placeholder="অর্ডার" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: +e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {form.image_url && <img src={form.image_url} className="w-full max-w-sm rounded" alt="" />}
          <div className="flex gap-2"><button onClick={save} className="bg-brand text-white px-4 py-2 rounded">সংরক্ষণ</button><button onClick={() => setAdding(false)} className="border px-4 py-2 rounded">ক্যান্সেল</button></div>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((b) => (
          <div key={b.id} className="bg-white border rounded-xl p-3 flex gap-3 items-center">
            <img src={b.image_url} className="w-32 h-16 object-cover rounded" alt="" />
            <div className="flex-1">
              <div className="font-semibold">{b.title || "—"}</div>
              <div className="text-xs text-muted-foreground">{b.link_url}</div>
            </div>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={b.is_active} onChange={(e) => toggle(b.id, e.target.checked)} /> সক্রিয়</label>
            <button onClick={() => remove(b.id)} className="text-destructive p-2"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
