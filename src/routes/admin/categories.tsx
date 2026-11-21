import { SafeImage } from "@/components/SafeImage";
import { CATEGORIES_COLUMNS } from "@/lib/read-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ChevronRight, ArrowLeft, GripVertical } from "lucide-react";
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
  return s.toLowerCase().trim().replace(/[^\\w\\s-]/g, "").replace(/\\s+/g, "-").slice(0, 60) || `c-${Date.now()}`;
}

function Categories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CategoryEditor | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

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
  const selectedParent = roots.find((c) => c.id === selectedParentId) ?? null;
  const visibleCategories = useMemo(
    () => selectedParent ? cats.filter((c) => c.parent_id === selectedParent.id) : roots,
    [cats, roots, selectedParent],
  );

  const refreshCategories = () => {
    qc.invalidateQueries({ queryKey: ["admin-cats-page"] });
    qc.invalidateQueries({ queryKey: ["home-data"] });
    qc.invalidateQueries({ queryKey: ["nav-categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ক্যাটাগরি ডিলিট হয়েছে");
    refreshCategories();
  };

  const saveOrder = async (ordered: CategoryRow[]) => {
    setSavingOrder(true);
    try {
      const results = await Promise.all(ordered.map((category, index) =>
        (supabase.from("categories") as any).update({ display_order: (index + 1) * 10 }).eq("id", category.id)
      ));
      const failed = results.find((result: any) => result.error);
      if (failed?.error) throw failed.error;
      refreshCategories();
      toast.success("ক্যাটাগরির ক্রম সংরক্ষণ হয়েছে");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ক্রম সংরক্ষণ করা যায়নি");
      refreshCategories();
    } finally {
      setSavingOrder(false);
      setDraggedId(null);
    }
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || savingOrder) return;
    const reordered = [...visibleCategories];
    const from = reordered.findIndex((item) => item.id === draggedId);
    const to = reordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return setDraggedId(null);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    void saveOrder(reordered);
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
      is_hidden_from_home: isChild ? true : (editing.is_hidden_from_home ?? false),
    };

    const table = supabase.from("categories") as any;
    const { error } = editing.id
      ? await table.update(payload).eq("id", editing.id)
      : await table.insert(payload);

    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    setEditing(null);
    refreshCategories();
  };

  const upload = async (file: File) => {
    try {
      const url = await uploadToBucket("category-images", safeFileName(file.name), file);
      setEditing((current) => current ? { ...current, image_url: url } : null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড হয়নি");
    }
  };

  const openEditor = (category?: CategoryRow, parentId: string | null = null) => {
    setEditing(category ? {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image_url: category.image_url ?? undefined,
      display_order: category.display_order,
      parent_id: category.parent_id,
      is_hidden_from_home: category.is_hidden_from_home,
    } : { name: "", slug: "", parent_id: parentId, is_hidden_from_home: Boolean(parentId) });
  };

  return (
    <AdminLayout>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">ক্যাটাগরি</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedParent ? `“${selectedParent.name}” এর সাব-ক্যাটাগরি` : "মূল ক্যাটাগরি নির্বাচন করে তার সাব-ক্যাটাগরি দেখুন।"}
          </p>
        </div>
        <button
          onClick={() => openEditor(undefined, selectedParent?.id ?? null)}
          className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> {selectedParent ? "সাব-ক্যাটাগরি যোগ" : "মূল ক্যাটাগরি যোগ"}
        </button>
      </div>

      {selectedParent && (
        <button onClick={() => setSelectedParentId(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline mt-3 mb-2">
          <ArrowLeft className="w-4 h-4" /> সব মূল ক্যাটাগরিতে ফিরুন
        </button>
      )}

      <div className="flex items-center justify-between gap-2 mt-5 mb-3">
        <h2 className="font-semibold">{selectedParent ? "সাব-ক্যাটাগরি" : "মেইন ক্যাটাগরি"} ({visibleCategories.length})</h2>
        <span className="text-xs text-muted-foreground">{savingOrder ? "ক্রম সংরক্ষণ হচ্ছে…" : "☰ ধরে টেনে উপর-নিচে সাজান"}</span>
      </div>

      {visibleCategories.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground">
          {selectedParent ? "এই মেইন ক্যাটাগরিতে এখনো কোনো সাব-ক্যাটাগরি নেই।" : "এখনো কোনো মেইন ক্যাটাগরি নেই।"}
          <div className="mt-3">
            <button onClick={() => openEditor(undefined, selectedParent?.id ?? null)} className="text-brand font-semibold">+ নতুন যোগ করুন</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleCategories.map((category) => {
            const childCount = cats.filter((item) => item.parent_id === category.id).length;
            return (
              <div
                key={category.id}
                draggable={!savingOrder}
                onDragStart={() => setDraggedId(category.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); handleDrop(category.id); }}
                onDragEnd={() => setDraggedId(null)}
                className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition ${draggedId === category.id ? "opacity-40 border-brand" : "hover:border-brand/50"}`}
              >
                <div className="cursor-grab touch-none text-muted-foreground" title="টেনে সাজান">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="w-14 h-14 shrink-0 rounded-lg bg-muted overflow-hidden">
                  {category.image_url ? <SafeImage src={category.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🌱</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{category.name}</div>
                  <div className="text-xs text-muted-foreground truncate">/{category.slug}</div>
                  {!selectedParent && <div className="text-xs text-muted-foreground mt-1">{childCount}টি সাব-ক্যাটাগরি · {category.is_hidden_from_home ? "হোমে লুকানো" : "হোমে দেখাবে"}</div>}
                </div>
                {!selectedParent && (
                  <button onClick={() => setSelectedParentId(category.id)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/70">
                    ভিতরে দেখুন <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => openEditor(category)} className="p-2 rounded-lg hover:bg-muted" title="এডিট"><Edit className="w-4 h-4" /></button>
                <button onClick={() => remove(category.id)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10" title="ডিলিট"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

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
            {editing.image_url && <SafeImage src={editing.image_url} className="w-24 h-24 object-cover rounded mb-2" alt="" />}

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
