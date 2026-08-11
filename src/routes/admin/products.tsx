import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Edit, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/products")({ component: Products });

type Product = {
  id?: string; name: string; slug: string; sku?: string;
  description?: string; short_description?: string;
  price: number; sale_price?: number | null; stock: number;
  category_id?: string | null; images?: string[];
  is_active?: boolean; is_featured?: boolean;
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || `p-${Date.now()}`;
}

function Products() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const { data: products } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: async () => {
      let q = supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (search) q = q.ilike("name", `%${search}%`);
      return (await q).data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => (await supabase.from("categories").select("*").order("display_order")).data ?? [],
  });

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
        <button onClick={() => setEditing({ name: "", slug: "", price: 0, stock: 0, images: [], is_active: true })} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> নতুন প্রোডাক্ট
        </button>
      </div>
      <input placeholder="খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full md:w-80 border rounded-lg px-3 py-2 mb-4" />

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left p-3">ছবি</th><th className="text-left p-3">নাম</th><th className="text-left p-3">ক্যাটাগরি</th><th className="text-right p-3">দাম</th><th className="text-right p-3">স্টক</th><th className="text-center p-3">স্ট্যাটাস</th><th className="text-right p-3">অ্যাকশন</th></tr>
            </thead>
            <tbody>
              {products?.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3"><img src={p.images?.[0] || "/placeholder.svg"} className="w-12 h-12 object-cover rounded" alt="" /></td>
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 text-xs">{(p.categories as { name?: string } | null)?.name ?? "-"}</td>
                  <td className="p-3 text-right">{taka(p.sale_price ?? p.price)}</td>
                  <td className="p-3 text-right">{p.stock}</td>
                  <td className="p-3 text-center">{p.is_active ? <span className="bg-brand-light text-brand-dark text-xs px-2 py-0.5 rounded">সক্রিয়</span> : <span className="bg-muted text-xs px-2 py-0.5 rounded">নিষ্ক্রিয়</span>}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => setEditing(p as Product)} className="p-1.5 hover:bg-muted rounded"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {!products?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো প্রোডাক্ট নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <ProductModal product={editing} categories={categories ?? []} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin-products"] }); setEditing(null); }} onAdded={() => qc.invalidateQueries({ queryKey: ["admin-products"] })} />}
    </AdminLayout>
  );
}

function ProductModal({ product, categories, onClose, onSaved, onAdded }: { product: Product; categories: { id: string; name: string }[]; onClose: () => void; onSaved: () => void; onAdded?: () => void }) {
  const [p, setP] = useState<Product>(product);
  const [saving, setSaving] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const newImgs = [...(p.images ?? [])];
    for (const file of Array.from(files)) {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) { toast.error(error.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      newImgs.push(publicUrl);
    }
    setP({ ...p, images: newImgs });
  };

  const save = async (addAnother = false) => {
    if (!p.name) return toast.error("নাম দিন");
    setSaving(true);
    const payload = {
      name: p.name, slug: p.slug || slugify(p.name), sku: p.sku ?? null,
      description: p.description ?? null, short_description: p.short_description ?? null,
      price: Number(p.price), sale_price: p.sale_price ? Number(p.sale_price) : null,
      stock: Number(p.stock), category_id: p.category_id || null,
      images: p.images ?? [], is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
    };
    const { error } = p.id
      ? await supabase.from("products").update(payload).eq("id", p.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    if (addAnother) {
      setP({ name: "", slug: "", price: 0, stock: 0, images: [], is_active: true, category_id: p.category_id ?? null });
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
            <div><label className="text-sm font-medium">স্টক</label><input type="number" value={p.stock} onChange={(e) => setP({ ...p, stock: +e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
            <div><label className="text-sm font-medium">SKU</label><input value={p.sku ?? ""} onChange={(e) => setP({ ...p, sku: e.target.value })} className="w-full border rounded-lg px-3 py-2 mt-1" /></div>
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
            <label className="text-sm font-medium">ছবি</label>
            <input type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} className="block mt-1 text-sm" />
            <div className="grid grid-cols-4 gap-2 mt-2">
              {p.images?.map((src, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={src} className="w-full h-full object-cover rounded" alt="" />
                  <button onClick={() => setP({ ...p, images: p.images?.filter((_, j) => j !== i) })} className="absolute top-1 right-1 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">×</button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={p.is_active ?? true} onChange={(e) => setP({ ...p, is_active: e.target.checked })} /> সক্রিয়</label>
          </div>
        </div>
        <div className="p-4 border-t flex flex-wrap gap-2 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
          {!p.id && <button disabled={saving} onClick={() => save(true)} className="px-4 py-2 border-2 border-brand text-brand rounded-lg font-semibold disabled:opacity-50">সংরক্ষণ + নতুন</button>}
          <button disabled={saving} onClick={() => save(false)} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold disabled:opacity-50">{saving ? "সংরক্ষণ..." : "সংরক্ষণ করুন"}</button>
        </div>
      </div>
    </div>
  );
}
