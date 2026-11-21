import { SafeImage } from "@/components/SafeImage";
import { CATEGORIES_COLUMNS, PRODUCTS_COLUMNS } from "@/lib/read-columns";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Edit, Trash2, X, Star, Film } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";
import { HomeProductOrganizer } from "@/components/admin/HomeProductOrganizer";

export const Route = createFileRoute("/admin/products")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: search.section === "home" || search.section === "landing" ? search.section : "all",
  }),
  component: Products,
});

type Product = {
  id?: string; name: string; slug: string; sku?: string;
  description?: string; short_description?: string;
  price: number; sale_price?: number | null; cost?: number | null; stock: number;
  category_id?: string | null; images?: string[];
  display_section: "home" | "landing";
  is_active?: boolean; is_featured?: boolean; is_popular?: boolean;
  categories?: { name?: string } | null;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || `p-${Date.now()}`;
}

function Products() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const { section: activeSection } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setActiveSection = (section: "home" | "landing" | "all") => {
    void navigate({ search: (previous) => ({ ...previous, section }), replace: true });
  };
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: products } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select(`${PRODUCTS_COLUMNS}, categories(name)`).order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(1000);
      if (search) q = q.ilike("name", `%${search}%`);
      return ((await q).data ?? []) as Product[];
    },
  });

  const homeProducts = products?.filter((product) => product.display_section === "home") ?? [];
  const landingProducts = products?.filter((product) => product.display_section === "landing") ?? [];
  const visibleProducts = activeSection === "landing" ? landingProducts : activeSection === "home" ? homeProducts : products ?? [];
  const visibleIds = visibleProducts.flatMap((product) => product.id ? [product.id] : []);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const { data: categories } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => (await supabase.from("categories").select(CATEGORIES_COLUMNS).order("display_order").limit(100)).data ?? [],
  });

  const togglePopular = async (product: Product) => {
    if (!product.id) return;
    const next = !(product.is_popular ?? false);
    const { error } = await supabase.from("products").update({ is_popular: next } as never).eq("id", product.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "পপুলার পণ্যে যোগ হয়েছে" : "পপুলার পণ্য থেকে সরানো হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["home-data-v1"] });
  };

  const removeSelected = async () => {
    const ids = selectedIds.filter((id) => visibleIds.includes(id));
    if (!ids.length) return toast.error("আগে প্রোডাক্ট সিলেক্ট করুন");
    if (!confirm(`সিলেক্ট করা ${ids.length}টি প্রোডাক্ট ডিলিট করবেন? এগুলো কোনো অফারে যুক্ত থাকলে শুধু অফারের সঙ্গে প্রোডাক্টের সংযোগ মুছে যাবে; অফার ও অর্ডারের রেকর্ড অক্ষত থাকবে। এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।`)) return;
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) return toast.error(`ডিলিট করা যায়নি: ${error.message}`);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    toast.success(`${ids.length}টি প্রোডাক্ট ডিলিট হয়েছে`);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["home-data-v1"] });
    qc.invalidateQueries({ queryKey: ["admin-landing-pages"] });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট করবেন?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ডিলিট হয়েছে");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold">প্রোডাক্ট</h1>
        <button onClick={() => setEditing({ name: "", slug: "", price: 0, cost: 0, stock: 0, images: [], is_active: true, is_popular: false, display_section: "home" })} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> নতুন প্রোডাক্ট
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="প্রোডাক্ট সেকশন">
        <button type="button" role="tab" aria-selected={activeSection === "home"} onClick={() => setActiveSection("home")} className={`px-4 py-2 rounded-lg text-sm font-semibold border ${activeSection === "home" ? "bg-brand text-white border-brand" : "bg-white text-foreground hover:bg-muted"}`}>Home Product <span className="ml-1 opacity-80">({homeProducts.length})</span></button>
        <button type="button" role="tab" aria-selected={activeSection === "landing"} onClick={() => setActiveSection("landing")} className={`px-4 py-2 rounded-lg text-sm font-semibold border ${activeSection === "landing" ? "bg-brand text-white border-brand" : "bg-white text-foreground hover:bg-muted"}`}>Landing Page Product <span className="ml-1 opacity-80">({landingProducts.length})</span></button>
        <button type="button" role="tab" aria-selected={activeSection === "all"} onClick={() => setActiveSection("all")} className={`px-4 py-2 rounded-lg text-sm font-semibold border ${activeSection === "all" ? "bg-brand text-white border-brand" : "bg-white text-foreground hover:bg-muted"}`}>All Product <span className="ml-1 opacity-80">({products?.length ?? 0})</span></button>
      </div>

      {activeSection === "home" ? <HomeProductOrganizer products={homeProducts as Array<{ id: string; name: string; category_id: string | null; sort_order?: number | null; price: number; sale_price?: number | null; images?: string[] }>} categories={(categories ?? []) as Array<{ id: string; name: string; slug: string; parent_id: string | null; display_order: number }>} /> : <>
      <input placeholder="খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full md:w-80 border rounded-lg px-3 py-2 mb-4" />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} disabled={visibleIds.length === 0} className="h-4 w-4 accent-emerald-700" />
          সব সিলেক্ট করুন <span className="text-muted-foreground font-normal">({visibleIds.length}টি)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{selectedIds.filter((id) => visibleIds.includes(id)).length}টি সিলেক্ট করা</span>
          <button type="button" onClick={removeSelected} disabled={!selectedIds.some((id) => visibleIds.includes(id))} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="h-4 w-4" /> সিলেক্ট করা ডিলিট
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="p-3"><input aria-label="সব প্রোডাক্ট সিলেক্ট করুন" type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} disabled={visibleIds.length === 0} className="h-4 w-4 accent-emerald-700" /></th><th className="text-left p-3">ছবি</th><th className="text-left p-3">নাম</th><th className="text-left p-3">ক্যাটাগরি</th><th className="text-right p-3">দাম</th><th className="text-right p-3">স্টক</th><th className="text-center p-3">পপুলার</th><th className="text-center p-3">স্ট্যাটাস</th><th className="text-right p-3">অ্যাকশন</th></tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.id} className={`border-t ${p.id && selectedIds.includes(p.id) ? "bg-emerald-50/60" : ""}`}>
                  <td className="p-3"><input aria-label={`${p.name} সিলেক্ট করুন`} type="checkbox" checked={!!p.id && selectedIds.includes(p.id)} onChange={(e) => p.id && setSelectedIds((current) => e.target.checked ? [...new Set([...current, p.id!])] : current.filter((id) => id !== p.id))} className="h-4 w-4 accent-emerald-700" /></td>
                  <td className="p-3"><SafeImage src={p.images?.[0] || "/placeholder.svg"} className="w-12 h-12 object-cover rounded" alt="" /></td>
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 text-xs">{p.categories?.name ?? "-"}</td>
                  <td className="p-3 text-right">{taka(p.sale_price ?? p.price)}</td>
                  <td className="p-3 text-right">{p.stock}</td>
                  <td className="p-3 text-center">
                    <button type="button" onClick={() => togglePopular(p)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${p.is_popular ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200" : "bg-muted text-muted-foreground hover:bg-amber-50 hover:text-amber-700"}`} title={p.is_popular ? "পপুলার পণ্য থেকে সরান" : "পপুলার পণ্যে যোগ করুন"}>
                      <Star className={`w-3.5 h-3.5 ${p.is_popular ? "fill-current" : ""}`} /> {p.is_popular ? "পপুলার" : "যোগ করুন"}
                    </button>
                  </td>
                  <td className="p-3 text-center">{p.is_active ? <span className="bg-brand-light text-brand-dark text-xs px-2 py-0.5 rounded">সক্রিয়</span> : <span className="bg-muted text-xs px-2 py-0.5 rounded">নিষ্ক্রিয়</span>}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(p as Product)} className="p-1.5 hover:bg-muted rounded"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => remove(p.id!)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {!visibleProducts.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{activeSection === "landing" ? "কোনো Landing Page-এ যুক্ত প্রোডাক্ট নেই" : activeSection === "home" ? "কোনো Home Product নেই" : "কোনো প্রোডাক্ট নেই"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {editing && <ProductModal product={editing} categories={categories ?? []} onClose={() => setEditing(null)} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-products"] });
          qc.invalidateQueries({ queryKey: ["home-data-v1"] });
          qc.invalidateQueries({ queryKey: ["shop-products"] });
          setEditing(null);
        }} onAdded={() => {
          qc.invalidateQueries({ queryKey: ["admin-products"] });
          qc.invalidateQueries({ queryKey: ["home-data-v1"] });
          qc.invalidateQueries({ queryKey: ["shop-products"] });
        }} />}
    </AdminLayout>
  );
}

function ProductModal({ product, categories, onClose, onSaved, onAdded }: { product: Product; categories: { id: string; name: string }[]; onClose: () => void; onSaved: () => void; onAdded?: () => void }) {
  const [p, setP] = useState<Product>(product);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInProgress = useRef(false);

  const upload = async (files: FileList | null) => {
    if (!files || uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        try {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          if (!isImage && !isVideo) {
            toast.error(`${file.name}: শুধু ছবি বা ভিডিও আপলোড করা যাবে`);
            continue;
          }
          if (isVideo && file.size > 90 * 1024 * 1024) {
            toast.error(`${file.name}: ভিডিও সর্বোচ্চ ৯০MB হতে পারবে`);
            continue;
          }
          const url = await uploadToBucket("product-images", safeFileName(file.name), file);
          uploaded.push(url);
        } catch (e) { toast.error(e instanceof Error ? e.message : "আপলোড হয়নি"); }
      }
      if (uploaded.length) {
        setP((current) => ({ ...current, images: [...(current.images ?? []), ...uploaded] }));
      }
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  };

  const save = async (addAnother = false) => {
    if (uploadInProgress.current) return toast.error("ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন");
    if (!p.name) return toast.error("নাম দিন");
    setSaving(true);
    const payload = {
      name: p.name, slug: p.slug || slugify(p.name), sku: p.sku ?? null,
      description: p.description ?? null, short_description: p.short_description ?? null,
      price: Number(p.price), sale_price: p.sale_price ? Number(p.sale_price) : null,
      cost: Number(p.cost ?? 0), stock: Number(p.stock), category_id: p.category_id || null,
      images: p.images ?? [], is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
      is_popular: p.is_popular ?? false,
      display_section: p.display_section,
    };
    const { error } = p.id
      ? await supabase.from("products").update(payload as never).eq("id", p.id)
      : await supabase.from("products").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    if (addAnother) {
      setP({ name: "", slug: "", price: 0, cost: 0, stock: 0, images: [], is_active: true, is_popular: false, category_id: p.category_id ?? null, display_section: "home" });
      onAdded?.();
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
          <h2 className="font-bold">{p.id ? "এডিট প্রোডাক্ট" : "নতুন প্রোডাক্ট"}</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-sm font-medium">নাম *</label><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value, slug: p.slug || slugify(e.target.value) })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">Slug</label><input value={p.slug} onChange={(e) => setP({ ...p, slug: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">দাম *</label><input type="number" value={p.price} onChange={(e) => setP({ ...p, price: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
            <div><label className="text-sm font-medium">সেল প্রাইস</label><input type="number" value={p.sale_price ?? ""} onChange={(e) => setP({ ...p, sale_price: e.target.value ? +e.target.value : null })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
            <div><label className="text-sm font-medium">প্রোডাক্ট কস্ট</label><input type="number" min="0" step="0.01" value={p.cost ?? 0} onChange={(e) => setP({ ...p, cost: Number(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2 mt-1" placeholder="প্রতি ইউনিট কস্ট" /></div>
            <div><label className="text-sm font-medium">স্টক</label><input type="number" value={p.stock} onChange={(e) => setP({ ...p, stock: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
            <div><label className="text-sm font-medium">SKU</label><input value={p.sku ?? ""} onChange={(e) => setP({ ...p, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          </div>
          <div>
            <label className="text-sm font-medium">প্রোডাক্ট সেকশন *</label>
            <select value={p.display_section} onChange={(e) => setP({ ...p, display_section: e.target.value as "home" | "landing" })} className="w-full border rounded-lg px-3 py-2 mt-1">
              <option value="home">Home Page Product</option>
              <option value="landing">Landing Page Product</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">এখান থেকে যেকোনো সময় প্রোডাক্টের সেকশন পরিবর্তন করতে পারবেন।</p>
          </div>
          <div><label className="text-sm font-medium">ক্যাটাগরি</label>
            <select value={p.category_id ?? ""} onChange={(e) => setP({ ...p, category_id: e.target.value || null })} className="w-full border rounded-lg px-3 py-2 mt-1">
              <option value="">— নির্বাচন করুন —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium">শর্ট ডেসক্রিপশন</label><textarea rows={2} value={p.short_description ?? ""} onChange={(e) => setP({ ...p, short_description: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-sm font-medium">পূর্ণ ডেসক্রিপশন</label><textarea rows={5} value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
          <div>
            <label className="text-sm font-medium">প্রোডাক্ট ছবি / ভিডিও</label>
            <input type="file" accept="image/*,video/*" multiple disabled={uploading} onChange={(e) => { upload(e.target.files); e.currentTarget.value = ""; }} className="block mt-1 text-sm disabled:opacity-50" />
            <p className="mt-1 text-xs text-muted-foreground">একসাথে ছবি ও ভিডিও আপলোড করতে পারবেন। ভিডিও সর্বোচ্চ ১০০MB। MP4 / WebM ভিডিও ব্যবহার করুন।</p>
            {uploading && <p className="mt-1 text-xs font-semibold text-amber-700">ছবি / ভিডিও R2-তে আপলোড হচ্ছে—শেষ না হওয়া পর্যন্ত সংরক্ষণ করবেন না।</p>}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {p.images?.map((src, i) => {
                const isVideo = /\\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(src);
                return (
                  <div key={i} className="relative aspect-square overflow-hidden rounded bg-muted">
                    {isVideo ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900 text-white">
                        <Film className="h-7 w-7" />
                        <span className="px-1 text-center text-[10px]">ভিডিও {i + 1}</span>
                      </div>
                    ) : <SafeImage src={src} className="w-full h-full object-cover" alt="" />}
                    <button onClick={() => setP((current) => ({ ...current, images: current.images?.filter((_, j) => j !== i) }))} className="absolute top-1 right-1 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">×</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={p.is_active ?? true} onChange={(e) => setP({ ...p, is_active: e.target.checked })} /> সক্রিয়</label>
            <label className="flex items-center gap-2 font-semibold text-amber-700"><input type="checkbox" checked={p.is_popular ?? false} onChange={(e) => setP({ ...p, is_popular: e.target.checked })} /> পপুলার পন্য হিসাবে যোগ করুন</label>
          </div>
        </div>
        <div className="p-4 border-t flex flex-wrap gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
          {!p.id && <button disabled={saving || uploading} onClick={() => save(true)} className="px-4 py-2 border-2 border-brand text-brand rounded-lg font-semibold disabled:opacity-50">সংরক্ষণ + নতুন</button>}
          <button disabled={saving || uploading} onClick={() => save(false)} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold disabled:opacity-50">{uploading ? "ছবি আপলোড হচ্ছে..." : saving ? "সংরক্ষণ..." : "সংরক্ষণ করুন"}</button>
        </div>
      </div>
    </div>
  );
}
