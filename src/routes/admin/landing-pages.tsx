import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Edit, X, PackagePlus } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";

type Feature = { title: string; text?: string };
type WhyItem = { title: string; text?: string };
type Review = { name: string; rating: number; text: string };
type Addon = {
  product_id?: string;
  name: string;
  price: number;
  image?: string;
  old_price?: number;
  badge?: string;
  delivery_fee?: number | null;
};

type LP = {
  id?: string;
  slug: string;
  title: string;
  top_bar_text?: string | null;
  product_id?: string | null;
  hero_title?: string;
  hero_image?: string;
  cta_text?: string;
  is_published?: boolean;
  regular_price?: number | null;
  sale_price?: number | null;
  main_delivery_fee?: number | null;
  features?: Feature[];
  why_choose_us?: WhyItem[];
  reviews?: Review[];
  addons?: Addon[];
  theme_color?: string;
};

export const Route = createFileRoute("/admin/landing-pages")({ component: LandingPagesAdmin });

const empty: LP = {
  slug: "",
  title: "",
  top_bar_text: "",
  cta_text: "অর্ডার করুন",
  main_delivery_fee: 70,
  features: [],
  why_choose_us: [],
  reviews: [],
  addons: [],
  theme_color: "#16a34a",
};

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };

function LandingPagesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LP | null>(null);
  const [tab, setTab] = useState<"main" | "page" | "products">("main");
  const [createProductFor, setCreateProductFor] = useState<"main" | number | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-landing"],
    queryFn: async () =>
      (await supabase.from("landing_pages").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: products, refetch: refetchProducts } = useQuery({
    queryKey: ["lp-products"],
    queryFn: async () =>
      ((await supabase
        .from("products")
        .select("id,name,price,sale_price,images")
        .eq("is_active", true)).data ?? []) as Product[],
  });
  const { data: categories } = useQuery({
    queryKey: ["lp-categories"],
    queryFn: async () =>
      ((await supabase.from("categories").select("id,name").order("display_order")).data ?? []) as { id: string; name: string }[],
  });

  const set = (patch: Partial<LP>) => editing && setEditing({ ...editing, ...patch });

  const save = async () => {
    if (!editing?.title || !editing?.slug) return toast.error("টাইটেল ও slug দিন");
    const payload = { ...editing };
    delete payload.id;
    const { error } = editing.id
      ? await supabase.from("landing_pages").update(payload).eq("id", editing.id)
      : await supabase.from("landing_pages").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষণ হয়েছে");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-landing"] });
  };

  const remove = async (id: string) => {
    if (!confirm("ডিলিট?")) return;
    await supabase.from("landing_pages").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-landing"] });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      return await uploadToBucket("site-assets", `landing-${safeFileName(file.name)}`, file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড হয়নি");
      return null;
    }
  };

  // Quick-create a product → also inserts into main products table, returns the new product
  const quickCreateProduct = async (data: { name: string; price: number; category_id?: string; image?: string }): Promise<Product | null> => {
    const slug = data.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60) + "-" + Date.now().toString(36);
    const { data: row, error } = await supabase
      .from("products")
      .insert({
        name: data.name,
        slug,
        price: data.price,
        stock: 100,
        is_active: true,
        category_id: data.category_id || null,
        images: data.image ? [data.image] : [],
      })
      .select("id,name,price,sale_price,images")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    toast.success("প্রোডাক্ট তৈরি হয়েছে — মেইন সাইটেও যুক্ত");
    refetchProducts();
    return row as Product;
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ল্যান্ডিং পেজ</h1>
        <button onClick={() => { setEditing({ ...empty }); setTab("main"); }} className="bg-brand text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> নতুন
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.map((p) => (
          <div key={p.id} className="bg-card border rounded-xl overflow-hidden">
            {p.hero_image && <img src={p.hero_image} className="w-full h-32 object-cover" alt="" />}
            <div className="p-4">
              <div className="font-bold">{p.title}</div>
              <div className="text-xs text-muted-foreground">/landing/{p.slug}</div>
              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${p.is_published ? "bg-green-100 text-green-700" : "bg-muted"}`}>
                  {p.is_published ? "পাবলিশড" : "ড্রাফট"}
                </span>
              </div>
              <div className="flex gap-1 mt-3">
                <Link to="/landing/$slug" params={{ slug: p.slug }} target="_blank" className="flex-1 text-center p-1.5 hover:bg-muted rounded text-xs">
                  <ExternalLink className="w-3.5 h-3.5 inline" /> দেখুন
                </Link>
                <button onClick={() => { setEditing({ ...empty, ...(p as unknown as LP) }); setTab("main"); }} className="flex-1 p-1.5 hover:bg-muted rounded text-xs">
                  <Edit className="w-3.5 h-3.5 inline" /> এডিট
                </button>
                <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-bold">{editing.id ? "এডিট" : "নতুন"} ল্যান্ডিং পেজ</div>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
            </div>

            {/* 3-tab nav */}
            <div className="flex gap-1 px-3 pt-3 border-b text-sm">
              {[
                ["main", "Main"],
                ["page", "Full page"],
                ["products", "Products"],
              ].map(([k, l]) => (
                <button key={k} onClick={() => setTab(k as typeof tab)}
                  className={`px-4 py-2 rounded-t-lg font-semibold ${tab === k ? "bg-brand text-white" : "hover:bg-muted"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {tab === "main" && (
                <>
                  <Field label="Landing page name">
                    <input value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="যেমন: প্রিমিয়াম টমেটো বীজ" className="w-full border rounded-lg px-3 py-2" />
                  </Field>
                  <Field label="Slug (URL)">
                    <input value={editing.slug} onChange={(e) => set({ slug: e.target.value })} placeholder="super-tomato" className="w-full border rounded-lg px-3 py-2 font-mono" />
                    <div className="text-xs text-muted-foreground mt-1">URL: /landing/{editing.slug || "..."}</div>
                  </Field>
                  <Field label="হেডারের উপরের টেক্সট (top bar)">
                    <input value={editing.top_bar_text ?? ""} onChange={(e) => set({ top_bar_text: e.target.value })} placeholder="যেমন: 🎉 আজকের বিশেষ অফার — ফ্রি ডেলিভারি!" className="w-full border rounded-lg px-3 py-2" />
                    <div className="text-xs text-muted-foreground mt-1">খালি রাখলে দেখাবে না</div>
                  </Field>
                  <div className="pt-3 border-t">
                    <Field label="থিম কালার">
                      <input type="color" value={editing.theme_color ?? "#16a34a"} onChange={(e) => set({ theme_color: e.target.value })} className="w-full h-10 border rounded-lg" />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 pt-3 border-t">
                    <input type="checkbox" checked={editing.is_published ?? false} onChange={(e) => set({ is_published: e.target.checked })} />
                    <span className="font-semibold">পাবলিশ করুন</span>
                  </label>
                </>
              )}

              {tab === "page" && (
                <>
                  <Field label="হেডলাইন">
                    <input value={editing.hero_title ?? ""} onChange={(e) => set({ hero_title: e.target.value })} placeholder="বড় টাইটেল" className="w-full border rounded-lg px-3 py-2" />
                  </Field>

                  <Field label="মূল ইমেজ">
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      const url = await uploadImage(f);
                      if (url) set({ hero_image: url });
                    }} />
                    <input value={editing.hero_image ?? ""} onChange={(e) => set({ hero_image: e.target.value })} placeholder="অথবা URL পেস্ট" className="w-full border rounded-lg px-3 py-2 text-sm mt-2" />
                    {editing.hero_image && <img src={editing.hero_image} className="mt-2 w-full max-h-48 object-cover rounded" alt="" />}
                  </Field>

                  <Field label="CTA বাটন টেক্সট">
                    <input value={editing.cta_text ?? ""} onChange={(e) => set({ cta_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="রেগুলার দাম (৳)">
                      <input type="number" value={editing.regular_price ?? ""} onChange={(e) => set({ regular_price: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2" />
                    </Field>
                    <Field label="অফার দাম (৳)">
                      <input type="number" value={editing.sale_price ?? ""} onChange={(e) => set({ sale_price: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2" />
                    </Field>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="font-semibold text-sm mb-2">প্রোডাক্টের বৈশিষ্ট্য (টেবিল)</div>
                    <RepeatList<Feature>
                      items={editing.features || []}
                      onChange={(features) => set({ features })}
                      empty={{ title: "", text: "" }}
                      render={(f, upd) => (
                        <>
                          <input placeholder="বৈশিষ্ট্য (যেমন: ৯৫% অঙ্কুরোদগম)" value={f.title} onChange={(e) => upd({ ...f, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" />
                          <input placeholder="বিস্তারিত (optional)" value={f.text ?? ""} onChange={(e) => upd({ ...f, text: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </>
                      )}
                    />
                  </div>

                  <div className="pt-3 border-t">
                    <div className="font-semibold text-sm mb-2">আমাদের থেকে কেনো কিনবে (টেবিল)</div>
                    <RepeatList<WhyItem>
                      items={editing.why_choose_us || []}
                      onChange={(why_choose_us) => set({ why_choose_us })}
                      empty={{ title: "", text: "" }}
                      render={(w, upd) => (
                        <>
                          <input placeholder="পয়েন্ট (যেমন: অরিজিনাল গ্যারান্টি)" value={w.title} onChange={(e) => upd({ ...w, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" />
                          <input placeholder="বিস্তারিত" value={w.text ?? ""} onChange={(e) => upd({ ...w, text: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                        </>
                      )}
                    />
                  </div>

                  <div className="pt-3 border-t">
                    <div className="font-semibold text-sm mb-2">কাস্টমার রিভিউ</div>
                    <RepeatList<Review>
                      items={editing.reviews || []}
                      onChange={(reviews) => set({ reviews })}
                      empty={{ name: "", rating: 5, text: "" }}
                      render={(r, upd) => (
                        <>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <input placeholder="নাম" value={r.name} onChange={(e) => upd({ ...r, name: e.target.value })} className="col-span-2 border rounded-lg px-3 py-2" />
                            <input type="number" min={1} max={5} value={r.rating} onChange={(e) => upd({ ...r, rating: Number(e.target.value) })} className="border rounded-lg px-3 py-2" />
                          </div>
                          <textarea placeholder="রিভিউ" rows={2} value={r.text} onChange={(e) => upd({ ...r, text: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                        </>
                      )}
                    />
                  </div>
                </>
              )}

              {tab === "products" && (
                <>
                  {/* Main product */}
                  <div className="border-2 border-brand/30 rounded-xl p-3 bg-brand/5">
                    <div className="font-bold text-sm mb-2 text-brand-dark">মূল প্রোডাক্ট</div>
                    <div className="flex gap-2">
                      <select value={editing.product_id ?? ""} onChange={(e) => set({ product_id: e.target.value || null })} className="flex-1 border rounded-lg px-3 py-2">
                        <option value="">— সিলেক্ট করুন —</option>
                        {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button type="button" onClick={() => setCreateProductFor("main")} className="px-3 py-2 border-2 border-brand text-brand rounded-lg text-sm font-semibold flex items-center gap-1 whitespace-nowrap">
                        <PackagePlus className="w-4 h-4" /> নতুন
                      </button>
                    </div>
                    <div className="mt-3">
                      <Field label="মূল প্রোডাক্টের ডেলিভারি চার্জ (৳)">
                        <div className="flex items-center gap-2">
                          <input type="number" value={editing.main_delivery_fee ?? 70} onChange={(e) => set({ main_delivery_fee: Number(e.target.value) })} className="flex-1 border rounded-lg px-3 py-2" />
                          <label className="flex items-center gap-1 text-sm">
                            <input type="checkbox" checked={Number(editing.main_delivery_fee) === 0} onChange={(e) => set({ main_delivery_fee: e.target.checked ? 0 : 70 })} />
                            ফ্রি
                          </label>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Addons */}
                  <div className="pt-3 border-t">
                    <div className="font-semibold text-sm mb-2">অতিরিক্ত প্যাকেজ / অ্যাডঅন</div>
                    <RepeatList<Addon>
                      items={editing.addons || []}
                      onChange={(addons) => set({ addons })}
                      empty={{ name: "", price: 0, delivery_fee: 70 }}
                      render={(a, upd, idx) => (
                        <>
                          <div className="flex gap-2 mb-2">
                            <select value={a.product_id ?? ""} onChange={(e) => {
                              const pid = e.target.value || undefined;
                              const p = products?.find((x) => x.id === pid);
                              upd(p ? { ...a, product_id: p.id, name: p.name, price: p.sale_price ?? p.price, image: p.images?.[0] } : { ...a, product_id: undefined });
                            }} className="flex-1 border rounded-lg px-3 py-2 text-sm">
                              <option value="">— Existing প্রোডাক্ট সিলেক্ট —</option>
                              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <button type="button" onClick={() => setCreateProductFor(idx)} className="px-3 py-2 border-2 border-brand text-brand rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap">
                              <PackagePlus className="w-3.5 h-3.5" /> নতুন
                            </button>
                          </div>
                          <input placeholder="প্যাকেজ নাম" value={a.name} onChange={(e) => upd({ ...a, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2 text-sm" />
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <label className="text-xs">দাম (৳)
                              <input type="number" value={a.price} onChange={(e) => upd({ ...a, price: Number(e.target.value) })} className="w-full border rounded-lg px-2 py-2 mt-0.5" />
                            </label>
                            <label className="text-xs">পুরোনো দাম
                              <input type="number" value={a.old_price ?? ""} onChange={(e) => upd({ ...a, old_price: e.target.value ? Number(e.target.value) : undefined })} className="w-full border rounded-lg px-2 py-2 mt-0.5" />
                            </label>
                            <label className="text-xs">ব্যাজ
                              <input value={a.badge ?? ""} onChange={(e) => upd({ ...a, badge: e.target.value || undefined })} className="w-full border rounded-lg px-2 py-2 mt-0.5" />
                            </label>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-xs flex-1">ডেলিভারি চার্জ (৳)
                              <input type="number" value={a.delivery_fee ?? 70} onChange={(e) => upd({ ...a, delivery_fee: Number(e.target.value) })} className="w-full border rounded-lg px-2 py-2 mt-0.5" />
                            </label>
                            <label className="flex items-center gap-1 text-xs mt-4">
                              <input type="checkbox" checked={Number(a.delivery_fee) === 0} onChange={(e) => upd({ ...a, delivery_fee: e.target.checked ? 0 : 70 })} />
                              ফ্রি
                            </label>
                          </div>
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const f = e.target.files?.[0]; if (!f) return;
                            const url = await uploadImage(f);
                            if (url) upd({ ...a, image: url });
                          }} className="text-xs mb-1" />
                          {a.image && <img src={a.image} alt="" className="w-20 h-20 object-cover rounded-lg" />}
                        </>
                      )}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
              <button onClick={save} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold">সংরক্ষণ</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick-create product modal */}
      {createProductFor !== null && editing && (
        <QuickCreateProduct
          categories={categories ?? []}
          onClose={() => setCreateProductFor(null)}
          onCreate={async (data) => {
            const p = await quickCreateProduct(data);
            if (!p) return;
            if (createProductFor === "main") {
              set({ product_id: p.id });
            } else {
              const idx = createProductFor;
              const list = [...(editing.addons || [])];
              list[idx] = {
                ...list[idx],
                product_id: p.id,
                name: p.name,
                price: p.sale_price ?? p.price,
                image: p.images?.[0],
              };
              set({ addons: list });
            }
            setCreateProductFor(null);
          }}
          uploadImage={uploadImage}
        />
      )}
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function RepeatList<T>({ items, onChange, empty, render }: {
  items: T[];
  onChange: (next: T[]) => void;
  empty: T;
  render: (item: T, update: (v: T) => void, idx: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border rounded-lg p-3 bg-muted/30 relative">
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
          {render(item, (v) => onChange(items.map((it, j) => (j === i ? v : it))), i)}
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...empty }])} className="w-full border-2 border-dashed rounded-lg py-2 text-sm font-semibold text-brand hover:bg-brand/5 flex items-center justify-center gap-1">
        <Plus className="w-4 h-4" /> যোগ করুন
      </button>
    </div>
  );
}

function QuickCreateProduct({
  categories,
  onClose,
  onCreate,
  uploadImage,
}: {
  categories: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (data: { name: string; price: number; category_id?: string; image?: string }) => Promise<void>;
  uploadImage: (f: File) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(199);
  const [categoryId, setCategoryId] = useState<string>("");
  const [image, setImage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <div className="font-bold">নতুন প্রোডাক্ট তৈরি করুন</div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground">এই প্রোডাক্ট মেইন সাইটেও যুক্ত হবে যাতে অর্ডার আসলে দেখায়।</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="প্রোডাক্টের নাম *" className="w-full border rounded-lg px-3 py-2" />
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="দাম (৳) *" className="w-full border rounded-lg px-3 py-2" />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            <option value="">— ক্যাটাগরি (optional) —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div>
            <input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const url = await uploadImage(f);
              if (url) setImage(url);
            }} className="text-sm" />
            {image && <img src={image} alt="" className="mt-2 w-24 h-24 object-cover rounded-lg" />}
          </div>
        </div>
        <div className="p-4 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button>
          <button
            disabled={busy || !name || !price}
            onClick={async () => {
              setBusy(true);
              await onCreate({ name, price, category_id: categoryId || undefined, image: image || undefined });
              setBusy(false);
            }}
            className="px-4 py-2 bg-brand text-white rounded-lg font-semibold disabled:opacity-60"
          >
            {busy ? "তৈরি হচ্ছে..." : "তৈরি করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}
