import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Edit, X, PackagePlus, Copy, Search } from "lucide-react";
import { uploadToBucket, safeFileName } from "@/lib/storage-upload";
import {
  mergeContent,
  DEFAULT_CONTENT,
  DEFAULT_FEATURES,
  DEFAULT_WHY,
  DEFAULT_REVIEWS,
  type LandingContent,
  type SeedRow,
  type Feature,
  type WhyItem,
  type Review,
  type ComboOffer,
} from "@/lib/landing-content";

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
  hero_subtitle?: string | null;
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
  planting_steps?: LandingContent | null;
};

export const Route = createFileRoute("/admin/landing-pages")({ component: LandingPagesAdmin });

const empty: LP = {
  slug: "",
  title: "",
  top_bar_text: "",
  cta_text: "অর্ডার করুন",
  main_delivery_fee: 70,
  features: DEFAULT_FEATURES,
  why_choose_us: DEFAULT_WHY,
  reviews: DEFAULT_REVIEWS,
  addons: [],
  theme_color: "#16a34a",
  planting_steps: DEFAULT_CONTENT,
};

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null; is_active?: boolean | null };

function ProductPicker({ products, value, onChange, placeholder, size = "sm" }: { products?: Product[]; value?: string | null; onChange: (id: string | null) => void; placeholder: string; size?: "sm" | "md" }) {
  const list = products ?? [];
  const cls = size === "md" ? "w-full border rounded-lg px-3 py-2" : "w-full border rounded-lg px-3 py-2 text-sm";
  return (
    <div className="flex-1 min-w-0">
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={cls}>
        <option value="">{placeholder}</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.is_active === false ? " (নিষ্ক্রিয়)" : ""}</option>
        ))}
      </select>
    </div>
  );
}


function LandingPagesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LP | null>(null);
  const [tab, setTab] = useState<"main" | "page" | "content" | "products" | "combo-offer">("main");
  const [createProductFor, setCreateProductFor] = useState<"main" | number | null>(null);
  const [productEditor, setProductEditor] = useState<"main" | number | null>(null);
  const [comboEditor, setComboEditor] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-landing"],
    queryFn: async () =>
      (await supabase.from("landing_pages").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: products, refetch: refetchProducts } = useQuery({    queryKey: ["lp-products"],
    queryFn: async () =>
      ((await supabase
        .from("products")
        .select("id,name,price,sale_price,images,is_active")
        .order("name")).data ?? []) as Product[],
  });
  const { data: categories } = useQuery({
    queryKey: ["lp-categories"],
    queryFn: async () =>
      ((await supabase.from("categories").select("id,name").order("display_order")).data ?? []) as { id: string; name: string }[],
  });

  const set = (patch: Partial<LP>) => editing && setEditing({ ...editing, ...patch });
  const C: LandingContent = mergeContent(editing?.planting_steps);
  const setC = (patch: Partial<LandingContent>) =>
    editing && setEditing({ ...editing, planting_steps: { ...C, ...patch } });

  const openEdit = (row: unknown) => {
    const p = row as LP;
    setEditing({
      ...empty,
      ...p,
      features: p.features?.length ? p.features : DEFAULT_FEATURES,
      why_choose_us: p.why_choose_us?.length ? p.why_choose_us : DEFAULT_WHY,
      reviews: p.reviews?.length ? p.reviews : DEFAULT_REVIEWS,
      planting_steps: mergeContent(p.planting_steps),
    });
    setTab("main");
  };

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

  const duplicateLandingPage = async (row: LP) => {
    if (!row.id) return toast.error("ল্যান্ডিং পেজের ID পাওয়া যায়নি");
    const suffix = Date.now().toString(36);
    const source = { ...row } as Record<string, unknown>;
    delete source.id;
    delete source.created_at;
    delete source.updated_at;
    const baseSlug = (row.slug || "landing-page").replace(/-copy(?:-[a-z0-9]+)?$/i, "");
    const payload = {
      ...source,
      title: `${row.title || "Landing page"} (কপি)`,
      slug: `${baseSlug}-copy-${suffix}`,
      is_published: false,
    };
    const { data: created, error } = await supabase
      .from("landing_pages")
      .insert(payload)
      .select("*")
      .single();
    if (error) return toast.error(`ডুপ্লিকেট তৈরি হয়নি: ${error.message}`);
    toast.success("ল্যান্ডিং পেজ ডুপ্লিকেট হয়েছে — এখন এডিট করুন");
    qc.invalidateQueries({ queryKey: ["admin-landing"] });
    if (created) openEdit(created);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      return await uploadToBucket("site-assets", `landing-${safeFileName(file.name)}`, file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "আপলোড হয়নি");
      return null;
    }
  };

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
    if (error) {      toast.error(error.message);
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
                <button onClick={() => openEdit(p)} className="flex-1 p-1.5 hover:bg-muted rounded text-xs">
                  <Edit className="w-3.5 h-3.5 inline" /> এডিট
                </button>
                <button onClick={() => duplicateLandingPage(p as never)} className="flex-1 p-1.5 hover:bg-green-50 text-green-700 rounded text-xs" title="ডুপ্লিকেট">
                  <Copy className="w-3.5 h-3.5 inline" /> ডুপ্লিকেট
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

            <div className="flex gap-1 px-3 pt-3 border-b text-sm">
              {([
                ["main", "Main"],
                ["page", "Full page"],
                ...((C.template as string) === "all" || C.template === "product" || C.template === "all-product" ? [] : [["content", "কনটেন্ট"] as const]),
                ["products", C.template === "product" || C.template === "all-product" ? "Product" : "Products"],
                ...((C.template as string) === "all-product" ? [["combo-offer", "Combo Offer"] as const] : []),
              ] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k as typeof tab)}
                  className={`px-4 py-2 rounded-t-lg font-semibold ${tab === k ? "bg-brand text-white" : "hover:bg-muted"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {tab === "main" && (
                <>
                  <Field label="টেমপ্লেট">
                    <div className="grid grid-cols-2 gap-2">
                      {([["combo", "Combo", "ফানেল স্টাইল — প্রোমো স্ক্রল, গিফট, কাউন্টডাউন, পপআপ"], ["all-product", "All product", "লাইভ Karala landing page-এর হুবহু ডিজাইন ও ফিচার"]] as const).map(([val, label, hint]) => (
                        <button key={val} type="button" onClick={() => setC({ template: val })}
                          className={`text-left border rounded-lg p-3 ${C.template === val ? "border-brand bg-brand/5" : "hover:bg-muted"}`}>
                          <div className="font-bold text-sm">{label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
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
                  <div className="pt-3 border-t"><Field label="থিম কালার"><input type="color" value={editing.theme_color ?? "#16a34a"} onChange={(e) => set({ theme_color: e.target.value })} className="w-full h-10 border rounded-lg" /></Field></div>
                  <label className="flex items-center gap-2 pt-3 border-t"><input type="checkbox" checked={editing.is_published ?? false} onChange={(e) => set({ is_published: e.target.checked })} /><span className="font-semibold">পাবলিশ করুন</span></label>
                </>
              )}
              {tab === "page" && (
                <>
                  <Field label="হেডলাইন"><input value={editing.hero_title ?? ""} onChange={(e) => set({ hero_title: e.target.value })} placeholder="বড় টাইটেল" className="w-full border rounded-lg px-3 py-2" /></Field>
                  <Field label="ইমেজের নিচের ছোট টেক্সট"><textarea rows={2} value={editing.hero_subtitle ?? ""} onChange={(e) => set({ hero_subtitle: e.target.value })} placeholder="খালি রাখলে দেখাবে না" className="w-full border rounded-lg px-3 py-2" /></Field>
                  <Field label="মূল ইমেজ">
                    <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) set({ hero_image: url }); }} />
                    <input value={editing.hero_image ?? ""} onChange={(e) => set({ hero_image: e.target.value })} placeholder="অথবা URL পেস্ট" className="w-full border rounded-lg px-3 py-2 text-sm mt-2" />
                    {editing.hero_image && <img src={editing.hero_image} className="mt-2 w-full max-h-48 object-cover rounded" alt="" />}
                  </Field>
                  <Field label="CTA বাটন টেক্সট"><input value={editing.cta_text ?? ""} onChange={(e) => set({ cta_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="রেগুলার দাম (৳)"><input type="number" value={editing.regular_price ?? ""} onChange={(e) => set({ regular_price: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <Field label="অফার দাম (৳)"><input type="number" value={editing.sale_price ?? ""} onChange={(e) => set({ sale_price: e.target.value ? Number(e.target.value) : null })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  </div>
                  <div className="pt-3 border-t"><div className="font-semibold text-sm mb-2">প্রোডাক্টের বৈশিষ্ট্য (টেবিল)</div><RepeatList<Feature> items={editing.features || []} onChange={(features) => set({ features })} empty={{ title: "", text: "" }} render={(f, upd) => (<><input placeholder="বৈশিষ্ট্য (যেমন: ৯৫% অঙ্কুরোদগম)" value={f.title} onChange={(e) => upd({ ...f, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" /><input placeholder="বিস্তারিত (optional)" value={f.text ?? ""} onChange={(e) => upd({ ...f, text: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></>)} /></div>
                  <div className="pt-3 border-t"><div className="font-semibold text-sm mb-2">আমাদের থেকে কেনো কিনবে (টেবিল)</div><RepeatList<WhyItem> items={editing.why_choose_us || []} onChange={(why_choose_us) => set({ why_choose_us })} empty={{ title: "", text: "" }} render={(w, upd) => (<><input placeholder="পয়েন্ট (যেমন: অরিজিনাল গ্যারান্টি)" value={w.title} onChange={(e) => upd({ ...w, title: e.target.value })} className="w-full border rounded-lg px-3 py-2 mb-2" /><input placeholder="বিস্তারিত" value={w.text ?? ""} onChange={(e) => upd({ ...w, text: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></>)} /></div>
                  <div className="pt-3 border-t"><div className="font-semibold text-sm mb-2">কাস্টমার রিভিউ</div><RepeatList<Review> items={editing.reviews || []} onChange={(reviews) => set({ reviews })} empty={{ name: "", rating: 5, text: "" }} render={(r, upd) => (<><div className="grid grid-cols-3 gap-2 mb-2"><input placeholder="নাম" value={r.name} onChange={(e) => upd({ ...r, name: e.target.value })} className="col-span-2 border rounded-lg px-3 py-2" /><input type="number" min={1} max={5} value={r.rating} onChange={(e) => upd({ ...r, rating: Number(e.target.value) })} className="border rounded-lg px-3 py-2" /></div><textarea placeholder="রিভিউ" rows={2} value={r.text} onChange={(e) => upd({ ...r, text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></>)} /></div>
                </>
              )}

              {tab === "content" && (C.template as string) !== "all" && (
                <>
                  <div className="text-xs text-muted-foreground">পেজের প্রতিটি টেক্সট ও ইমেজ এখান থেকে বদলানো যাবে। খালি রাখলে সেই অংশ পেজে দেখাবে না।</div>
                  <div className="rounded-lg border p-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!C.show_popup} onChange={(e) => setC({ show_popup: e.target.checked })} />সাইটে ঢোকার সাথে সাথে পপআপ দেখাবে</label>
                    {editing.slug === "seedcombo" && (
                      <Field label="পপআপ কনটেন্ট টাইপ">
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setC({ popup_mode: "text" })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${C.popup_mode !== "image" ? "border-brand bg-brand/5 text-brand" : "hover:bg-muted"}`}>টেক্সট</button>
                          <button type="button" onClick={() => setC({ popup_mode: "image" })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${C.popup_mode === "image" ? "border-brand bg-brand/5 text-brand" : "hover:bg-muted"}`}>ইমেজ</button>
                        </div>
                      </Field>
                    )}
                    {editing.slug === "seedcombo" && C.popup_mode === "image" ? (
                      <Field label="পপআপ ইমেজ">
                        <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) setC({ popup_image: url, popup_mode: "image" }); }} />
                        <input value={C.popup_image} onChange={(e) => setC({ popup_image: e.target.value, popup_mode: "image" })} placeholder="অথবা ইমেজ URL পেস্ট করুন" className="w-full border rounded-lg px-3 py-2 text-sm mt-2" />
                        {C.popup_image && <div className="mt-2 space-y-2"><img src={C.popup_image} className="w-full max-h-64 object-contain rounded-lg border bg-muted/20" alt="পপআপ প্রিভিউ" /><button type="button" onClick={() => setC({ popup_image: "" })} className="text-xs font-semibold text-destructive hover:underline">ইমেজ সরান</button></div>}
                      </Field>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="পপআপ টাইটেল"><input value={C.popup_title} onChange={(e) => setC({ popup_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                          <Field label="পপআপ বাটন টেক্সট"><input value={C.popup_cta} onChange={(e) => setC({ popup_cta: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                        </div>
                        <Field label="পপআপ টেক্সট"><textarea rows={3} value={C.popup_text} onChange={(e) => setC({ popup_text: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field>
                      </>
                    )}
                    <Field label="কত মিলিসেকেন্ড পরে দেখাবে"><input type="number" value={C.popup_delay} onChange={(e) => setC({ popup_delay: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  </div>
                  <Field label="উপরের স্ক্রলিং টেক্সট (এক লাইনে একটি)"><textarea rows={5} value={C.promo_messages.join("\n")} onChange={(e) => setC({ promo_messages: e.target.value.split("\n").filter((x) => x.trim()) })} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="হেডারের বাটন টেক্সট"><input value={C.header_cta_text} onChange={(e) => setC({ header_cta_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <Field label="অফার ব্যাজ (BEST OFFER)"><input value={C.offer_badge_text} onChange={(e) => setC({ offer_badge_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <Field label="দামের আগের শব্দ"><input value={C.price_prefix} onChange={(e) => setC({ price_prefix: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <Field label="ছাড়ের পরের শব্দ"><input value={C.discount_suffix} onChange={(e) => setC({ discount_suffix: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  </div>
                  <Field label="হিরো কার্ডের নিচের লাইন"><input value={C.hero_note} onChange={(e) => setC({ hero_note: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  <Field label="লাল অর্ডার বাটনের টেক্সট"><input value={C.red_cta_text} onChange={(e) => setC({ red_cta_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                  <div className="pt-3 border-t"><div className="font-semibold text-sm mb-2">অতিরিক্ত ইমেজ (হিরো ইমেজের নিচে)</div><ImageList items={C.gallery_images} onChange={(gallery_images) => setC({ gallery_images })} uploadImage={uploadImage} /></div>
                  <div className="pt-3 border-t space-y-3">
                    <div className="font-semibold text-sm">ফ্রি গিফট সেকশন</div>
                    <Field label="উপরের লাল বাটনের টেক্সট"><input value={C.gift_cta_text} onChange={(e) => setC({ gift_cta_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="টাইটেল (কালো অংশ)"><input value={C.gift_title_1} onChange={(e) => setC({ gift_title_1: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="টাইটেল (কমলা অংশ)"><input value={C.gift_title_2} onChange={(e) => setC({ gift_title_2: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field></div>
                    <Field label="সাব-টেক্সট"><input value={C.gift_subtitle} onChange={(e) => setC({ gift_subtitle: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field>
                    <Field label="গিফট ইমেজ"><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) setC({ gift_image: url }); }} /><input value={C.gift_image} onChange={(e) => setC({ gift_image: e.target.value })} placeholder="অথবা URL পেস্ট" className="w-full border rounded-lg px-3 py-2 text-sm mt-2" />{C.gift_image && <img src={C.gift_image} className="mt-2 w-full max-h-48 object-cover rounded" alt="" />}</Field>
                    <Field label="গিফট বুলেট পয়েন্ট (এক লাইনে একটি)"><textarea rows={4} value={C.gift_bullets.join("\n")} onChange={(e) => setC({ gift_bullets: e.target.value.split("\n").filter((x) => x.trim()) })} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field>
                  </div>
                  <div className="pt-3 border-t space-y-3">
                    <div className="font-semibold text-sm">বীজের তালিকা (টেবিল)</div>
                    <div className="grid grid-cols-2 gap-3"><Field label="ছোট হেডিং"><input value={C.seed_kicker} onChange={(e) => setC({ seed_kicker: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="বড় হেডিং"><input value={C.seed_title} onChange={(e) => setC({ seed_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="কলাম ১ নাম"><input value={C.seed_col_1} onChange={(e) => setC({ seed_col_1: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="কলাম ২ নাম"><input value={C.seed_col_2} onChange={(e) => setC({ seed_col_2: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field></div>
                    <p className="text-xs text-muted-foreground">নিচের + বোতামে নতুন বীজ যোগ করুন, ডিলিট আইকনে বাদ দিন। যত রো থাকবে, ল্যান্ডিং পেজে ঠিক তত লাইনই দেখাবে।</p>
                    <RepeatList<SeedRow> items={C.seed_table} onChange={(seed_table) => setC({ seed_table })} empty={{ name: "", qty: "", image: "" }} render={(s, upd) => (<div className="pr-6 space-y-2"><div className="grid grid-cols-2 gap-2"><input placeholder="বীজের নাম" value={s.name} onChange={(e) => upd({ ...s, name: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" /><input placeholder="পরিমাণ" value={s.qty} onChange={(e) => upd({ ...s, qty: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" /></div><div className="flex items-center gap-2">{s.image ? <img src={s.image} alt={s.name} className="w-12 h-12 object-cover rounded-lg border" /> : <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center text-lg">🌱</div>}<input type="file" accept="image/*" onChange={async (ev) => { const fl = ev.target.files?.[0]; if (!fl) return; const url = await uploadImage(fl); if (url) upd({ ...s, image: url }); }} className="text-xs flex-1" />{s.image && <button type="button" onClick={() => upd({ ...s, image: "" })} className="text-xs text-destructive font-semibold">সরান</button>}</div></div>)} />
                  </div>
                  <div className="pt-3 border-t space-y-3"><label className="flex items-center gap-2 font-semibold text-sm"><input type="checkbox" checked={C.show_countdown !== false} onChange={(e) => setC({ show_countdown: e.target.checked })} />কাউন্টডাউন টাইমার দেখান</label><div className="grid grid-cols-2 gap-3"><Field label="টাইমারের টেক্সট"><input value={C.countdown_title} onChange={(e) => setC({ countdown_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="কত ঘণ্টা"><input type="number" min={1} value={C.countdown_hours} onChange={(e) => setC({ countdown_hours: Number(e.target.value) || 1 })} className="w-full border rounded-lg px-3 py-2" /></Field></div></div>
                  <div className="pt-3 border-t space-y-3"><div className="font-semibold text-sm">সেকশন হেডিং</div><div className="grid grid-cols-2 gap-3"><Field label="বৈশিষ্ট্য — ছোট"><input value={C.features_kicker} onChange={(e) => setC({ features_kicker: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="বৈশিষ্ট্য — বড়"><input value={C.features_title} onChange={(e) => setC({ features_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="কেন কিনবেন — ছোট"><input value={C.why_kicker} onChange={(e) => setC({ why_kicker: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="কেন কিনবেন — বড়"><input value={C.why_title} onChange={(e) => setC({ why_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="রিভিউ — ছোট"><input value={C.reviews_kicker} onChange={(e) => setC({ reviews_kicker: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="রিভিউ — বড়"><input value={C.reviews_title} onChange={(e) => setC({ reviews_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="প্যাকেজ — ছোট"><input value={C.package_kicker} onChange={(e) => setC({ package_kicker: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="প্যাকেজ — বড়"><input value={C.package_title} onChange={(e) => setC({ package_title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field></div></div>
                  <div className="pt-3 border-t space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="নামের লেবেল"><input value={C.name_label} onChange={(e) => setC({ name_label: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="ফোনের লেবেল"><input value={C.phone_label} onChange={(e) => setC({ phone_label: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="ঠিকানার লেবেল"><input value={C.address_label} onChange={(e) => setC({ address_label: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field><Field label="সাবমিট বাটন"><input value={C.submit_text} onChange={(e) => setC({ submit_text: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field></div><Field label="ফর্মের নিচের ছোট নোট"><input value={C.cod_note} onChange={(e) => setC({ cod_note: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></Field></div>
                  <button type="button" onClick={() => setEditing({ ...editing, planting_steps: { ...DEFAULT_CONTENT } })} className="text-xs underline text-muted-foreground">সব কনটেন্ট ডিফল্টে ফিরিয়ে নিন</button>
                </>
              )}

              {tab === "combo-offer" && C.template === "all-product" && (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">✦</div>
                      <div>
                        <div className="font-black text-sm text-emerald-900">Combo Offer</div>
                        <p className="mt-1 text-xs leading-5 text-emerald-800/75">প্রতিটি Combo Offer সাধারণত এক লাইনের compact row-তে থাকবে। নাম, ইমেজ ও দাম দেখা যাবে; Edit/View চাপলে বিস্তারিত মডাল খুলবে।</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {(C.combo_offers || []).map((item, index) => (
                      <div key={index} className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-slate-50">
                          {item.image ? (
                            <img src={item.image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] font-bold text-slate-400">IMG</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-slate-900">{item.name || "নাম নেই"}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-medium text-slate-500">
                            <span>{item.quantity || "১ পিস"}</span>
                            <span>•</span>
                            <span>{Number(item.delivery_fee) === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ৳${item.delivery_fee ?? 70}`}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-black text-emerald-700">৳{item.price || 0}</div>
                          {item.old_price ? <div className="text-[10px] text-slate-400 line-through">৳{item.old_price}</div> : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setComboEditor(index)}
                          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          title="এডিট / ভিউ"
                        >
                          <Edit className="mr-1 inline h-3.5 w-3.5" />এডিট / ভিউ
                        </button>
                        <button
                          type="button"
                          onClick={() => setC({ combo_offers: (C.combo_offers || []).filter((_, i) => i !== index) })}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="ডিলিট"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const next = [...(C.combo_offers || []), { name: "", price: 0, old_price: undefined, image: "", delivery_fee: 70, quantity: "১ পিস" }];
                        setC({ combo_offers: next });
                        setComboEditor(next.length - 1);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-200 py-2.5 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <Plus className="h-4 w-4" /> Combo Offer যোগ করুন
                    </button>
                  </div>

                  {comboEditor !== null && C.combo_offers?.[comboEditor] && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={() => setComboEditor(null)}>
                      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">Combo Offer এডিট</div>
                            <div className="text-[11px] text-slate-500">নাম, ইমেজ, দাম, পরিমাণ ও ডেলিভারি চার্জ</div>
                          </div>
                          <button type="button" onClick={() => setComboEditor(null)} className="rounded-lg p-1.5 hover:bg-slate-100">
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        {(() => {
                          const item = C.combo_offers![comboEditor];
                          const update = (patch: Partial<ComboOffer>) => {
                            const list = [...(C.combo_offers || [])];
                            list[comboEditor] = { ...list[comboEditor], ...patch };
                            setC({ combo_offers: list });
                          };
                          return (
                            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
                              <div className="grid grid-cols-[88px_1fr] gap-3">
                                <div className="h-[88px] w-[88px] overflow-hidden rounded-xl border bg-slate-50">
                                  {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-400">No image</div>}
                                </div>
                                <div className="space-y-2">
                                  <Field label="প্রডাক্টের নাম">
                                    <input value={item.name} onChange={(e) => update({ name: e.target.value })} placeholder="যেমন: ২৪ প্রকার সবজির বীজ কম্বো" className="w-full rounded-xl border px-3 py-2.5 font-semibold" />
                                  </Field>
                                  <div className="flex gap-2">
                                    <label className="flex-1 rounded-lg border bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                      <span className="block">ইমেজ আপলোড</span>
                                      <input type="file" accept="image/*" className="mt-1 w-full text-[10px]" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) update({ image: url }); }} />
                                    </label>
                                    <input value={item.image ?? ""} onChange={(e) => update({ image: e.target.value })} placeholder="Image URL" className="flex-1 rounded-lg border px-2.5 py-2 text-xs" />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2.5">
                                <Field label="প্রডাক্ট প্রাইজ (৳)">
                                  <input type="number" min={0} value={item.price} onChange={(e) => update({ price: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border px-3 py-2.5 font-black" />
                                </Field>
                                <Field label="আগের দাম (৳) — optional">
                                  <input type="number" min={0} value={item.old_price ?? ""} onChange={(e) => update({ old_price: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })} className="w-full rounded-xl border px-3 py-2.5" />
                                </Field>
                                <Field label="পরিমাণ / পিস">
                                  <input value={item.quantity ?? ""} onChange={(e) => update({ quantity: e.target.value })} placeholder="১ পিস / ৫ পিস / ১ প্যাক" className="w-full rounded-xl border px-3 py-2.5 font-semibold" />
                                </Field>
                                <Field label="ডেলিভারি চার্জ (৳)">
                                  <input type="number" min={0} value={item.delivery_fee ?? 70} onChange={(e) => update({ delivery_fee: Math.max(0, Number(e.target.value) || 0) })} className="w-full rounded-xl border px-3 py-2.5 font-semibold" />
                                </Field>
                              </div>

                              <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2.5 text-xs font-semibold">
                                <input type="checkbox" checked={Number(item.delivery_fee) === 0} onChange={(e) => update({ delivery_fee: e.target.checked ? 0 : 70 })} />
                                ফ্রি ডেলিভারি
                              </label>

                              <div className="flex justify-between gap-2 border-t pt-3">
                                <button type="button" onClick={() => { setC({ combo_offers: (C.combo_offers || []).filter((_, i) => i !== comboEditor) }); setComboEditor(null); }} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
                                  <Trash2 className="mr-1 inline h-3.5 w-3.5" /> ডিলিট
                                </button>
                                <button type="button" onClick={() => setComboEditor(null)} className="rounded-lg bg-brand px-4 py-2 text-xs font-black text-white">সম্পন্ন</button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab === "products" && (
                <>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="mb-2">
                      <div className="text-sm font-black text-slate-900">প্রডাক্ট</div>
                      <div className="text-[11px] text-slate-500">সাধারণ অবস্থায় শুধু প্রডাক্টের নাম, ইমেজ ও দাম দেখাবে। বিস্তারিত পরিবর্তন করতে এডিট / ভিউ চাপুন।</div>
                    </div>
                    <div className="space-y-1.5">
                      {(editing.addons || []).map((item, index) => (
                        <div key={index} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-slate-50">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[10px] font-bold text-slate-400">IMG</div>}</div>
                          <div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{item.name || "নাম নেই"}</div><div className="text-[10px] text-slate-500">অতিরিক্ত প্যাকেজ</div></div>
                          <div className="shrink-0 text-sm font-black text-emerald-700">৳{item.price || 0}</div>
                          <button type="button" onClick={() => setProductEditor(index)} className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><Edit className="mr-1 inline h-3.5 w-3.5" />এডিট / ভিউ</button>
                          <button type="button" onClick={() => set({ addons: (editing.addons || []).filter((_, i) => i !== index) })} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => { const list=[...(editing.addons||[]), {name:"",price:0,delivery_fee:70}]; set({addons:list}); setProductEditor(list.length-1); }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" />অতিরিক্ত প্রডাক্ট যোগ করুন</button>
                  </div>

                  {productEditor !== null && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3" onClick={() => setProductEditor(null)}>
                      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
                          <div><div className="text-sm font-black text-slate-900">{productEditor === "main" ? "মেইন প্রডাক্ট এডিট" : "প্রডাক্ট এডিট"}</div><div className="text-[11px] text-slate-500">প্রডাক্ট, ইমেজ, দাম ও ডেলিভারি সেটিংস</div></div>
                          <button type="button" onClick={() => setProductEditor(null)} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                        </div>
                        {productEditor === "main" ? (
                          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
                            <Field label="মেইন প্রডাক্ট নির্বাচন"><div className="flex gap-2"><ProductPicker products={products} value={editing.product_id} onChange={(id) => set({ product_id: id })} placeholder="— প্রডাক্ট নির্বাচন করুন —" size="md" /><button type="button" onClick={() => setCreateProductFor("main")} className="shrink-0 rounded-lg border-2 border-brand px-3 py-2 text-sm font-semibold text-brand flex items-center gap-1"><PackagePlus className="h-4 w-4" />নতুন</button></div></Field>
                            {editing.product_id && (() => { const main=products?.find(p=>p.id===editing.product_id); return main ? <div className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white">{main.images?.[0]?<img src={main.images[0]} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs text-slate-400">IMG</div>}</div><div><div className="text-sm font-black">{main.name}</div><div className="text-xs text-slate-500 mt-1">বর্তমান দাম: ৳{main.sale_price??main.price}</div></div></div>:null; })()}
                            <Field label="মেইন প্রডাক্টের ডেলিভারি চার্জ (৳)"><div className="flex items-center gap-2"><input type="number" min={0} value={editing.main_delivery_fee??70} onChange={e=>set({main_delivery_fee:Math.max(0,Number(e.target.value)||0)})} className="flex-1 rounded-xl border px-3 py-2.5 font-semibold"/><label className="flex items-center gap-1.5 rounded-lg border bg-slate-50 px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={Number(editing.main_delivery_fee)===0} onChange={e=>set({main_delivery_fee:e.target.checked?0:70})}/>ফ্রি</label></div></Field>
                            <div className="flex justify-end border-t pt-3"><button type="button" onClick={()=>setProductEditor(null)} className="rounded-lg bg-brand px-4 py-2 text-xs font-black text-white">সম্পন্ন</button></div>
                          </div>
                        ) : (() => {
                          const index=productEditor as number; const item=(editing.addons||[])[index]; if(!item) return null;
                          const update=(patch:Partial<Addon>)=>{const list=[...(editing.addons||[])]; list[index]={...list[index],...patch}; set({addons:list});};
                          return <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
                            <Field label="প্রডাক্ট নির্বাচন"><div className="flex gap-2"><ProductPicker products={products} value={item.product_id??null} onChange={pid=>{const p=products?.find(x=>x.id===pid); update(p?{product_id:p.id,name:p.name,price:p.sale_price??p.price,image:p.images?.[0]}:{product_id:undefined});}} placeholder="— Existing প্রডাক্ট —"/><button type="button" onClick={()=>setCreateProductFor(index)} className="shrink-0 rounded-lg border-2 border-brand px-3 py-2 text-sm font-semibold text-brand flex items-center gap-1"><PackagePlus className="h-4 w-4"/>নতুন</button></div></Field>
                            <div className="grid grid-cols-[88px_1fr] gap-3"><div className="h-[88px] w-[88px] overflow-hidden rounded-xl border bg-slate-50">{item.image?<img src={item.image} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs text-slate-400">No image</div>}</div><Field label="প্রডাক্টের নাম"><input value={item.name} onChange={e=>update({name:e.target.value})} className="w-full rounded-xl border px-3 py-2.5 font-semibold"/></Field><Field label="প্রডাক্ট ইমেজ"><input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;const url=await uploadImage(f);if(url)update({image:url});e.target.value="";}} className="w-full rounded-xl border px-3 py-2 text-sm"/><input value={item.image??""} onChange={e=>update({image:e.target.value||undefined})} placeholder="অথবা Image URL পেস্ট" className="mt-2 w-full rounded-xl border px-3 py-2 text-xs"/>{item.image&&<img src={item.image} alt="" className="mt-2 h-20 w-20 rounded-xl border object-cover"/>}</Field></div>
                            <div className="grid grid-cols-2 gap-2.5"><Field label="দাম (৳)"><input type="number" min={0} value={item.price} onChange={e=>update({price:Math.max(0,Number(e.target.value)||0)})} className="w-full rounded-xl border px-3 py-2.5 font-black"/></Field><Field label="পুরোনো দাম (৳)"><input type="number" min={0} value={item.old_price??""} onChange={e=>update({old_price:e.target.value?Number(e.target.value):undefined})} className="w-full rounded-xl border px-3 py-2.5"/></Field><Field label="ব্যাজ"><input value={item.badge??""} onChange={e=>update({badge:e.target.value||undefined})} className="w-full rounded-xl border px-3 py-2.5"/></Field><Field label="ডেলিভারি চার্জ (৳)"><input type="number" min={0} value={item.delivery_fee??70} onChange={e=>update({delivery_fee:Math.max(0,Number(e.target.value)||0)})} className="w-full rounded-xl border px-3 py-2.5"/></Field></div>
                            <label className="flex items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2.5 text-xs font-semibold"><input type="checkbox" checked={Number(item.delivery_fee)===0} onChange={e=>update({delivery_fee:e.target.checked?0:70})}/>ফ্রি ডেলিভারি</label>
                            <div className="flex justify-between border-t pt-3"><button type="button" onClick={()=>{set({addons:(editing.addons||[]).filter((_,i)=>i!==index)});setProductEditor(null)}} className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-3.5 w-3.5"/>ডিলিট</button><button type="button" onClick={()=>setProductEditor(null)} className="rounded-lg bg-brand px-4 py-2 text-xs font-black text-white">সম্পন্ন</button></div>
                          </div>;
                        })()}
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>

            <div className="p-4 border-t flex gap-2 justify-end"><button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button><button onClick={save} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold">সংরক্ষণ</button></div>
          </div>
        </div>
      )}

      {createProductFor !== null && editing && (
        <QuickCreateProduct categories={categories ?? []} onClose={() => setCreateProductFor(null)} onCreate={async (data) => { const p = await quickCreateProduct(data); if (!p) return; if (createProductFor === "main") { set({ product_id: p.id }); } else { const idx = createProductFor; const list = [...(editing.addons || [])]; list[idx] = { ...list[idx], product_id: p.id, name: p.name, price: p.sale_price ?? p.price, image: p.images?.[0] }; set({ addons: list }); } setCreateProductFor(null); }} uploadImage={uploadImage} />
      )}
    </AdminLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><div className="text-sm font-semibold mb-1.5">{label}</div>{children}</div>; }

function RepeatList<T>({ items, onChange, empty, render }: { items: T[]; onChange: (next: T[]) => void; empty: T; render: (item: T, update: (v: T) => void, idx: number) => React.ReactNode; }) {
  return <div className="space-y-2">{items.map((item, i) => <div key={i} className="border rounded-lg p-3 bg-muted/30 relative"><button onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-destructive"><Trash2 className="w-4 h-4" /></button>{render(item, (v) => onChange(items.map((it, j) => (j === i ? v : it))), i)}</div>)}<button onClick={() => onChange([...items, { ...empty }])} className="w-full border-2 border-dashed rounded-lg py-2 text-sm font-semibold text-brand hover:bg-brand/5 flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> যোগ করুন</button></div>;
}

function QuickCreateProduct({ categories, onClose, onCreate, uploadImage }: { categories: { id: string; name: string }[]; onClose: () => void; onCreate: (data: { name: string; price: number; category_id?: string; image?: string }) => Promise<void>; uploadImage: (f: File) => Promise<string | null>; }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState<number>(199); const [categoryId, setCategoryId] = useState<string>(""); const [image, setImage] = useState<string>(""); const [busy, setBusy] = useState(false);
  return <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3" onClick={onClose}><div className="bg-card rounded-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}><div className="p-4 border-b flex justify-between items-center"><div className="font-bold">নতুন প্রোডাক্ট তৈরি করুন</div><button onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-4 space-y-3"><div className="text-xs text-muted-foreground">এই প্রোডাক্ট মেইন সাইটেও যুক্ত হবে যাতে অর্ডার আসলে দেখায়।</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="প্রোডাক্টের নাম *" className="w-full border rounded-lg px-3 py-2" /><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="দাম (৳) *" className="w-full border rounded-lg px-3 py-2" /><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2"><option value="">— ক্যাটাগরি (optional) —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) setImage(url); }} className="text-sm" />{image && <img src={image} alt="" className="mt-2 w-24 h-24 object-cover rounded-lg" />}</div></div><div className="p-4 border-t flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 border rounded-lg">ক্যান্সেল</button><button disabled={busy || !name || !price} onClick={async () => { setBusy(true); await onCreate({ name, price, category_id: categoryId || undefined, image: image || undefined }); setBusy(false); }} className="px-4 py-2 bg-brand text-white rounded-lg font-semibold disabled:opacity-60">{busy ? "তৈরি হচ্ছে..." : "তৈরি করুন"}</button></div></div></div>;
}

function ImageList({ items, onChange, uploadImage }: { items: string[]; onChange: (next: string[]) => void; uploadImage: (f: File) => Promise<string | null>; }) {
  return <div className="space-y-2">{items.map((url, i) => <div key={url + i} className="flex items-center gap-2 border rounded-lg p-2 bg-muted/30"><img src={url} alt="" className="w-14 h-14 rounded object-cover shrink-0" /><input value={url} onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))} className="flex-1 border rounded-lg px-2 py-1.5 text-xs" /><button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-4 h-4" /></button></div>)}<label className="w-full border-2 border-dashed rounded-lg py-2 text-sm font-semibold text-brand hover:bg-brand/5 flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> ইমেজ আপলোড<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImage(f); if (url) onChange([...items, url]); e.target.value = ""; }} /></label></div>;
}