import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FolderOpen, GripVertical, Edit } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { SafeImage } from "@/components/SafeImage";
import { taka } from "@/lib/format";
import { toast } from "sonner";

type Category = { id: string; name: string; slug: string; parent_id: string | null; display_order: number };
type Product = { id: string; name: string; slug: string; stock: number; category_id: string | null; sort_order?: number | null; price: number; sale_price?: number | null; cost?: number | null; images?: string[]; sku?: string; description?: string; short_description?: string; is_active?: boolean; is_featured?: boolean; is_popular?: boolean; display_section?: "home" | "landing"; };

export function HomeProductOrganizer({ products, categories, onEdit }: { products: Product[]; categories: Category[]; onEdit: (product: Product) => void }) {
  const qc = useQueryClient();
  const [rootId, setRootId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const roots = useMemo(() => categories.filter((c) => !c.parent_id).filter((root) => {
    const ids = categories.filter((c) => c.parent_id === root.id).map((c) => c.id);
    return products.some((p) => p.category_id === root.id || (p.category_id && ids.includes(p.category_id)));
  }), [categories, products]);
  const root = roots.find((c) => c.id === rootId) ?? null;
  const subs = root ? categories.filter((c) => c.parent_id === root.id) : [];
  const direct = root ? products.filter((p) => p.category_id === root.id) : [];
  const sub = subs.find((c) => c.id === subId) ?? null;
  const subProducts = sub ? products.filter((p) => p.category_id === sub.id) : [];

  const persistCategoryOrder = async (items: Category[]) => {
    const results = await Promise.all(items.map((item, index) => supabase.from("categories").update({ display_order: index + 1 } as never).eq("id", item.id)));
    const error = results.find((r) => r.error)?.error;
    if (error) return toast.error("ক্যাটাগরির ক্রম সংরক্ষণ হয়নি: " + error.message);
    toast.success("ক্যাটাগরির ক্রম সংরক্ষণ হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-cats"] });
    qc.invalidateQueries({ queryKey: ["shop-categories"] });
    qc.invalidateQueries({ queryKey: ["cat-list"] });
    qc.invalidateQueries({ queryKey: ["home-data-v1"] });
  };
  const persistProductOrder = async (items: Product[]) => {
    const results = await Promise.all(items.map((item, index) => supabase.from("products").update({ sort_order: index + 1 } as never).eq("id", item.id)));
    const error = results.find((r) => r.error)?.error;
    if (error) return toast.error("পণ্যের ক্রম সংরক্ষণ হয়নি: " + error.message);
    toast.success("পণ্যের ক্রম সংরক্ষণ হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["shop-products"] });
  };
  const reorder = <T extends { id: string },>(items: T[], targetId: string, persist: (next: T[]) => void) => {
    if (!dragId) return;
    const from = items.findIndex((item) => item.id === dragId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...items]; const moved = next.splice(from, 1)[0]; next.splice(to, 0, moved);
    persist(next);
  };
  const card = (item: Category, items: Category[], index: number) => (
    <div key={item.id} draggable onDragStart={() => setDragId(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { reorder(items, item.id, persistCategoryOrder); setDragId(null); }} onDragEnd={() => setDragId(null)} className={"flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm cursor-grab active:cursor-grabbing " + (dragId === item.id ? "opacity-40" : "")}>
      <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" />
      <button type="button" onClick={() => { if (!rootId) { setRootId(item.id); setSubId(null); } else setSubId(item.id); }} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><FolderOpen className="h-5 w-5" /></span>
        <span className="min-w-0"><span className="block font-bold">{item.name}</span><span className="text-xs text-muted-foreground">{index + 1} নম্বর অবস্থান</span></span>
      </button><ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  const productRow = (item: Product, items: Product[], index: number) => (
    <div key={item.id} draggable onDragStart={() => setDragId(item.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { reorder(items, item.id, persistProductOrder); setDragId(null); }} onDragEnd={() => setDragId(null)} className={"flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing " + (dragId === item.id ? "opacity-40" : "")}>
      <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" /><SafeImage src={item.images?.[0] || "/placeholder.svg"} className="h-12 w-12 rounded-lg object-cover" alt="" />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">ক্রম {index + 1}</p></div>
      <span className="text-sm font-bold">{taka(item.sale_price ?? item.price)}</span><button type="button" onClick={(event) => { event.stopPropagation(); onEdit(item); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white" aria-label={`${item.name} এডিট করুন`}><Edit className="h-3.5 w-3.5" />এডিট</button>
    </div>
  );

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {rootId && <button type="button" onClick={() => { setRootId(null); setSubId(null); }} className="rounded-lg border p-2 hover:bg-muted" aria-label="মূল ক্যাটাগরিতে ফিরুন"><ChevronLeft className="h-4 w-4" /></button>}
        {subId && <button type="button" onClick={() => setSubId(null)} className="rounded-lg border p-2 hover:bg-muted" aria-label="সাব-ক্যাটাগরিতে ফিরুন"><ChevronLeft className="h-4 w-4" /></button>}
        <div><h2 className="text-lg font-bold">{sub?.name ?? root?.name ?? "Home Product ক্যাটাগরি"}</h2><p className="text-xs text-muted-foreground">ড্র্যাগ করে উপর-নিচে সাজান—Shop পেজেও একই ক্রম দেখাবে।</p></div>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="পণ্য খুঁজুন..." className="w-full rounded-lg border px-3 py-2 text-sm sm:w-64" />
    </div>
    {!rootId ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {roots.map((c, i) => card(c, roots, i))}
      {!roots.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-muted-foreground">কোনো ক্যাটাগরিতে Home Product পাওয়া যায়নি।</p>}
    </div> : !subId ? <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subs.map((c, i) => card(c, subs, i))}
        {!subs.length && !direct.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-muted-foreground">এই ক্যাটাগরিতে কোনো সাব-ক্যাটাগরি বা পণ্য নেই।</p>}
      </div>
      {direct.length > 0 && <div className="space-y-2"><h3 className="font-bold">এই ক্যাটাগরির সরাসরি পণ্য</h3>{direct.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => productRow(p, direct, i))}</div>}
    </div> : <div className="space-y-2">
      {subProducts.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p, i) => productRow(p, subProducts, i))}
      {!subProducts.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">এই সাব-ক্যাটাগরিতে কোনো পণ্য নেই।</p>}
    </div>}
  </section>;
}
