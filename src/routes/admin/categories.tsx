import { CATEGORIES_COLUMNS } from "@/lib/read-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

export const Route = createFileRoute("/admin/categories")({ component: Categories });

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  display_order: number;
  is_hidden_from_home: boolean;
  parent_id: string | null;
};

type CategoryEditor = {
  id?: string;
  name: string;
  slug: string;
  image_url?: string;
  display_order?: number;
  is_hidden_from_home?: boolean;
  parent_id?: string | null;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || `c-${Date.now()}`;
}

function Categories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CategoryEditor | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["admin-cats-page"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select(CATEGORIES_COLUMNS)
        .order("display_order")
        .order("created_at").limit(100);
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const roots = useMemo(() => cats.filter((c) => !c.parent_id), [cats]);
  const parentName = (parentId: string | null) => cats.find((c) => c.id === parentId)?.name;

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ক্যাটাগরি ডিলিট হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-cats-page"] });
    qc.invalidateQueries({ queryKey: ["home-data"] });
    qc.invalidateQueries({ queryKey: ["nav-categories"] });
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return toast.error("ক্যাটাগরির নাম দিন");

    const isChild = Boolean(editing.parent_id);
    const payload = {
      name: editing.name.trim(),
      slug: editing.slug || slugify(editing.name),
      image_url: editing.image_url ?? null,
      display_order: editing.display_order ?? 0,
      parent_id: editing.parent_id || null,
      // Subcategories live inside their parent and never render as separate home cards.
      is_hidden_from_home: isChild ? true : (editing.is_hidden_from_home ?? false),
    };

    const table = supabase.from("categories") as any;
    const { error } = editing.id
      ? await table.update(payload).eq("id", editing.id)
      : await table.insert(payload);

    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-cats-page"] });
    qc.invalidateQueries({ queryKey: ["home-data"] });
    qc.invalidateQueries({ queryKey: ["nav-categories"] });
  };

  const upload = async (file: File) => {
    try {
      const url = await uploadToBucket("category-images", safeFileName(file.name), file);
      setEditing(editing ? { ...editing, image_url: url } : null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড হয়নি");
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold">ক্যাটাগরি</h1>
          <p className="text-sm text-muted-foreground mt-1">মূল ক্যাটাগরির ভিতরে সাব-ক্যাটাগরি তৈরি করুন এবং কোন মূল ক্যাটাগরি হোমে দেখাবে সেটি নিয়ন্ত্রণ করুন।</p>
        </div>
        <button
          onClick={() => setEditing({ name: "", slug: "", parent_id: null, is_hidden_from_home: false })}
          className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> নতুন
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        {cats.map((c) => (
          <div key={c.id} className="bg-white border rounded-xl p-3">
            <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden">
              {c.image_url ? (
                <img src={c.image_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🌱</div>
              )}
            </div>
            <div className="font-semibold">{c.name}</div>
            <div className="text-xs text-muted-foreground">/{c.slug}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">
                {c.parent_id ? `সাব: ${parentName(c.parent_id) ?? "মূল ক্যাটাগরি"}` : "মূল ক্যাটাগরি"}
              </span>
              {!c.parent_id && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.is_hidden_from_home ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700"}`}>
                  {c.is_hidden_from_home ? "হোমে লুকানো" : "হোমে দেখাবে"}
                </span>
              )}
            </div>
            <div className="flex gap-1 mt-2">
              <button
                onClick={() => setEditing({
                  id: c.id,
                  name: c.name,
                  slug: c.slug,
                  image_url: c.image_url ?? undefined,
                  display_order: c.display_order,
                  parent_id: c.parent_id,
                  is_hidden_from_home: c.is_hidden_from_home,
                })}
                className="flex-1 p-1.5 hover:bg-muted rounded text-sm"
              >
                <Edit className="w-4 h-4 inline" />
              </button>
              <button onClick={() => remove(c.id)} className="flex-1 p-1.5 hover:bg-destructive/10 text-destructive rounded text-sm">
                <Trash2 className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold mb-3">{editing.id ? "এডিট" : "নতুন"} ক্যাটাগরি</h2>

            <label className="text-xs font-semibold text-muted-foreground">নাম</label>
            <input
              placeholder="যেমন: ফুলের বীজ"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 mb-2 mt-1"
            />

            <label className="text-xs font-semibold text-muted-foreground">Slug</label>
            <input
              placeholder="flower-seeds"
              value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 mb-2 mt-1"
            />

            <label className="text-xs font-semibold text-muted-foreground">Parent Category</label>
            <select
              value={editing.parent_id ?? ""}
              onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}
              className="w-full border rounded-lg px-3 py-2 mb-2 mt-1 bg-white"
            >
              <option value="">কোনো Parent নেই — Root Category</option>
              {roots.filter((c) => c.id !== editing.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label className="text-xs font-semibold text-muted-foreground">Display order</label>
            <input
              type="number"
              placeholder="অর্ডার"
              value={editing.display_order ?? 0}
              onChange={(e) => setEditing({ ...editing, display_order: +e.target.value })}
              className="w-full border rounded-lg px-3 py-2 mb-3 mt-1"
            />

            {!editing.parent_id ? (
              <label className="flex items-center gap-2 border rounded-lg px-3 py-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!(editing.is_hidden_from_home ?? false)}
                  onChange={(e) => setEditing({ ...editing, is_hidden_from_home: !e.target.checked })}
                />
                <span className="text-sm font-medium">হোম পেজে দেখাবে</span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2 mb-3">সাব-ক্যাটাগরি হোমে আলাদা করে দেখাবে না; Parent Category খুললে দেখাবে।</p>
            )}

            <label className="text-xs font-semibold text-muted-foreground">ক্যাটাগরি ছবি</label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="block my-2 text-sm" />
            {editing.image_url && <img src={editing.image_url} className="w-24 h-24 object-cover rounded mb-2" alt="" />}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
              <button onClick={save} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
