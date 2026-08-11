import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

export const Route = createFileRoute("/admin/categories")({ component: Categories });

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || `c-${Date.now()}`; }

function Categories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id?: string; name: string; slug: string; image_url?: string; display_order?: number } | null>(null);

  const { data: cats } = useQuery({
    queryKey: ["admin-cats-page"],
    queryFn: async () => (await supabase.from("categories").select("*").order("display_order")).data ?? [],
  });

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-cats-page"] });
  };

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name, slug: editing.slug || slugify(editing.name),
      image_url: editing.image_url ?? null, display_order: editing.display_order ?? 0,
    };
    const { error } = editing.id
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-cats-page"] });
  };

  const upload = async (file: File) => {
    try {
      const url = await uploadToBucket("category-images", safeFileName(file.name), file);
      setEditing(editing ? { ...editing, image_url: url } : null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "আপলোড হয়নি"); }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ক্যাটাগরি</h1>
        <button onClick={() => setEditing({ name: "", slug: "" })} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> নতুন</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cats?.map((c) => (
          <div key={c.id} className="bg-white border rounded-xl p-3">
            <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden">{c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🌱</div>}</div>
            <div className="font-semibold">{c.name}</div>
            <div className="text-xs text-muted-foreground">/{c.slug}</div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setEditing({ id: c.id, name: c.name, slug: c.slug, image_url: c.image_url ?? undefined, display_order: c.display_order })} className="flex-1 p-1.5 hover:bg-muted rounded text-sm"><Edit className="w-4 h-4 inline" /></button>
              <button onClick={() => remove(c.id)} className="flex-1 p-1.5 hover:bg-destructive/10 text-destructive rounded text-sm"><Trash2 className="w-4 h-4 inline" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold mb-3">{editing.id ? "এডিট" : "নতুন"} ক্যাটাগরি</h2>
            <input placeholder="নাম" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input placeholder="slug" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input type="number" placeholder="অর্ডার" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="block mb-2 text-sm" />
            {editing.image_url && <img src={editing.image_url} className="w-24 h-24 object-cover rounded mb-2" alt="" />}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
              <button onClick={save} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
