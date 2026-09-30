import { BANNERS_COLUMNS } from "@/lib/read-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

export const Route = createFileRoute("/admin/banners")({ component: Banners });

type Banner = { id: string; title: string | null; image_url: string; link_url: string | null; display_order: number; is_active: boolean };
type BannerForm = { title: string; image_url: string; link_url: string; display_order: number };
const emptyForm: BannerForm = { title: "", image_url: "", link_url: "", display_order: 0 };

function Banners() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);

  const { data } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select(BANNERS_COLUMNS).order("display_order").limit(100)).data ?? [],
  });

  const upload = async (file: File) => {
    try {
      const url = await uploadToBucket("banners", safeFileName(file.name), file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (e) { toast.error(e instanceof Error ? e.message : "আপলোড হয়নি"); }
  };

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setAdding(true); };
  const openEdit = (b: Banner) => {
    setAdding(false);
    setEditing(b);
    setForm({ title: b.title ?? "", image_url: b.image_url, link_url: b.link_url ?? "", display_order: b.display_order ?? 0 });
  };
  const closeForm = () => { setAdding(false); setEditing(null); setForm({ ...emptyForm }); };

  const save = async () => {
    if (!form.image_url) return toast.error("ব্যানার ইমেজ আপলোড করুন");
    if (editing) {
      const { error } = await supabase.from("banners").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("ব্যানার আপডেট হয়েছে");
    } else {
      const { error } = await supabase.from("banners").insert({ ...form, is_active: true });
      if (error) return toast.error(error.message);
      toast.success("যোগ হয়েছে");
    }
    closeForm();
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const toggle = async (id: string, val: boolean) => {
    const { error } = await supabase.from("banners").update({ is_active: val }).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-banners"] });
  };

  const formOpen = adding || !!editing;

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ব্যানার</h1>
        <button onClick={openAdd} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন</button>
      </div>

      {formOpen && (
        <div className="bg-white border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex justify-between items-center"><h2 className="font-bold">{editing ? "ব্যানার এডিট করুন" : "নতুন ব্যানার"}</h2><button onClick={closeForm} className="p-1"><X className="w-5 h-5" /></button></div>
          <input placeholder="টাইটেল" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="লিংক URL (ঐচ্ছিক)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input type="number" placeholder="অর্ডার" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: +e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          {form.image_url && <img src={form.image_url} className="w-full max-w-sm rounded" alt="ব্যানার প্রিভিউ" />}
          <div className="flex gap-2"><button onClick={save} className="bg-brand text-white px-4 py-2 rounded">{editing ? "আপডেট" : "সংরক্ষণ"}</button><button onClick={closeForm} className="border px-4 py-2 rounded">ক্যান্সেল</button></div>
        </div>
      )}

      <div className="space-y-3">
        {data?.map((b) => (
          <div key={b.id} className="bg-white border rounded-xl p-3 flex gap-3 items-center">
            <img src={b.image_url} className="w-32 h-16 object-cover rounded" alt="" />
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{b.title || "—"}</div><div className="text-xs text-muted-foreground truncate">{b.link_url}</div></div>
            <label className="flex items-center gap-1 text-sm shrink-0"><input type="checkbox" checked={b.is_active} onChange={(e) => toggle(b.id, e.target.checked)} /> সক্রিয়</label>
            <button onClick={() => openEdit(b)} className="text-brand p-2 hover:bg-brand/10 rounded-lg" title="এডিট" aria-label="ব্যানার এডিট করুন"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => remove(b.id)} className="text-destructive p-2 hover:bg-destructive/10 rounded-lg" title="ডিলিট" aria-label="ব্যানার ডিলিট করুন"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
