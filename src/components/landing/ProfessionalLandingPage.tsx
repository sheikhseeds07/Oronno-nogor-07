import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Truck, Star, Sparkles } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { notifyOrderError } from "@/lib/order-block";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { getFbContext } from "@/lib/fb-context";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { Footer } from "@/components/layout/Footer";
import { mergeContent, DEFAULT_FEATURES, DEFAULT_WHY, DEFAULT_REVIEWS, Feature, WhyItem, Review } from "@/lib/landing-content";
import { toImg, imgFallback } from "@/lib/img";
import brandLogoFile from "@/assets/logo.jpg";
import { LP_SHARED_STYLE, LpHeaderCountdown, LpPackageSelector, LpFloatingCta, LpOrderNote, LpCheckoutCard } from "@/components/landing/lp-shared";


type Variant = "premium" | "modern";
type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; badge?: string; delivery_fee?: number | null };
type Props = { slug: string; variant: Variant };

const icons = ["🌱", "✅", "🪴", "🚚", "🛡️", "⭐"];

export function ProfessionalLandingPage({ slug, variant }: Props) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const [selected, setSelected] = useState(0);
  const qty = 1;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [formInView, setFormInView] = useState(false);
  const goOrder = () => document.getElementById("lp-order")?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { const el = document.getElementById("lp-order"); if (!el || typeof IntersectionObserver === "undefined") return; const obs = new IntersectionObserver(([e]) => setFormInView(Boolean(e?.isIntersecting)), { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }); obs.observe(el); return () => obs.disconnect(); });
  const { data: page, isLoading } = useQuery({
    queryKey: ["landing-professional", slug],
    queryFn: async () => (await supabase.from("landing_pages").select("*, products(*)").eq("slug", slug).eq("is_published", true).maybeSingle()).data,
  });
  const { data: settingsRow } = useQuery({ queryKey: ["site-settings-public"], queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data });
  const settings = (settingsRow?.settings as { site_name?: string; tagline?: string; logo_url?: string }) ?? {};
  const C = mergeContent(page?.planting_steps);
  const product = (page?.products ?? null) as Product | null;
  const addons = (Array.isArray(page?.addons) ? page.addons : []) as Addon[];
  const features = ((Array.isArray(page?.features) && page.features.length ? page.features : DEFAULT_FEATURES) as Feature[]);
  const why = ((Array.isArray(page?.why_choose_us) && page.why_choose_us.length ? page.why_choose_us : DEFAULT_WHY) as WhyItem[]);
  const reviews = ((Array.isArray(page?.reviews) && page.reviews.length ? page.reviews : DEFAULT_REVIEWS) as Review[]);
  const heroImage = page?.hero_image || product?.images?.[0] || "/placeholder.svg";
  const basePrice = Number(page?.sale_price ?? product?.sale_price ?? page?.regular_price ?? product?.price ?? 0);
  const regularPrice = Number(page?.regular_price ?? product?.price ?? 0) || null;
  const delivery = Number(page?.main_delivery_fee ?? 70);
  const packages = useMemo(() => {
    const first = product ? [{ name: product.name, price: basePrice, old: regularPrice, image: heroImage, product_id: product.id, delivery_fee: delivery }] : [];
    return [...first, ...addons.map(a => ({ name: a.name, price: Number(a.price), old: a.old_price, image: a.image, product_id: a.product_id, delivery_fee: a.delivery_fee == null ? delivery : Number(a.delivery_fee) }))];
  }, [product, addons, basePrice, regularPrice, heroImage, delivery]);
  const selectedPackage = packages[selected] || packages[0];
  const subtotal = selectedPackage ? selectedPackage.price * qty : 0;
  const shipping = selectedPackage ? selectedPackage.delivery_fee : delivery;
  const total = subtotal + shipping;
  const theme = page?.theme_color || (variant === "premium" ? "#166534" : "#0f766e");
  const discount = regularPrice && basePrice < regularPrice ? Math.round(((regularPrice - basePrice) / regularPrice) * 100) : 0;

  useCheckoutAutofill({ form, setForm: updater => setForm(f => updater(f) as typeof f), items: selectedPackage ? [{ id: selectedPackage.product_id || `addon-${selected}`, name: selectedPackage.name, price: selectedPackage.price, quantity: qty }] : [], subtotal, total, deliveryFee: shipping });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) return toast.error("নাম, ফোন ও ঠিকানা পূরণ করুন");
    if (!selectedPackage) return toast.error("প্রোডাক্ট নির্বাচন করুন");
    setSubmitting(true);
    try {
      const items = [{ id: selectedPackage.product_id || `addon-${selected}`, name: selectedPackage.name, price: selectedPackage.price, quantity: qty }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: { customer_name: form.name, customer_phone: form.phone.replace(/[\s-]/g, ""), customer_address: form.address, delivery_fee: shipping, items, notes: form.note || null, ...getFbContext() } });
      trackPurchase(items, total, order.id);
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (err) { notifyOrderError(err); setSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen grid place-items-center"><div className="animate-pulse font-bold">লোড হচ্ছে...</div></div>;
  if (!page) return <div className="min-h-screen grid place-items-center">পেজ পাওয়া যায়নি</div>;
  const brand = settings.site_name || "Sheikh Seeds";
  const logo = settings.logo_url || brandLogoFile;
  const Cta = ({ children = C.red_cta_text }: { children?: React.ReactNode }) => <button type="button" onClick={() => document.getElementById("lp-order")?.scrollIntoView({ behavior: "smooth" })} className="w-full rounded-2xl py-4 px-6 text-white font-black text-[17px] shadow-lg transition hover:-translate-y-0.5 active:scale-[.99]" style={{ background: theme }}>{children}</button>;

  return <div className={variant === "premium" ? "min-h-screen bg-[#f5f7f2] text-slate-800" : "min-h-screen bg-slate-50 text-slate-800"} style={{ ["--lp-theme" as string]: theme }}>
    <FacebookPixel eager /><style>{LP_SHARED_STYLE}</style>
    {C.show_popup && <div className="hidden" aria-hidden="true" />}
    <div className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0"><img src={toImg(logo)} alt={brand} className="w-9 h-9 rounded-full object-cover"/><div className="min-w-0"><div className="font-black truncate">{brand}</div>{settings.tagline && <div className="text-[10px] text-slate-500 truncate">{settings.tagline}</div>}</div></div>
        <LpHeaderCountdown hours={Number(C.countdown_hours) || 3} />
      </div>
    </div>
    {page.top_bar_text && <div className="text-white text-center text-xs font-bold py-2 px-3" style={{ background: theme }}>{page.top_bar_text}</div>}

    <main className="max-w-5xl mx-auto px-4 py-5 sm:py-8 space-y-6">
      <section className={variant === "premium" ? "grid md:grid-cols-2 gap-6 items-center rounded-[30px] bg-white border border-emerald-100 p-5 sm:p-8 shadow-xl" : "grid md:grid-cols-2 gap-6 items-center rounded-[30px] bg-white p-4 sm:p-7 shadow-[0_20px_60px_-35px_rgba(15,118,110,.55)]"}>
        <div className="order-2 md:order-1">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black mb-3" style={{ background: `${theme}14`, color: theme }}><Sparkles className="w-3.5 h-3.5"/>{C.offer_badge_text || "বিশেষ অফার"}</div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">{page.hero_title || page.title}</h1>
          {page.hero_subtitle && <p className="mt-3 text-slate-500 leading-relaxed">{page.hero_subtitle}</p>}
          <div className="mt-5 flex items-end gap-3"><span className="text-4xl font-black" style={{ color: theme }}>{taka(basePrice)}</span>{regularPrice && regularPrice > basePrice && <span className="text-lg text-slate-400 line-through">{taka(regularPrice)}</span>}</div>
          {discount > 0 && <div className="mt-2 inline-flex rounded-lg bg-red-50 text-red-600 px-2.5 py-1 text-xs font-black">{discount}% {C.discount_suffix || "ছাড়"}</div>}
          <p className="mt-4 text-sm text-slate-600 flex items-center gap-2"><Truck className="w-4 h-4" style={{ color: theme }}/>{C.hero_note || "সারা দেশে ক্যাশ অন ডেলিভারি"}</p>
          <div className="mt-5"><Cta /></div>
        </div>
        <div className="order-1 md:order-2"><div className="rounded-[26px] overflow-hidden bg-slate-100 border shadow-sm"><img src={toImg(heroImage, { w: 1000, q: 86 })} onError={e => imgFallback(e, heroImage)} alt={page.title} className="w-full aspect-square object-cover"/></div></div>
      </section>

      {packages.length > 1 && <section className="rounded-3xl bg-white border p-4 sm:p-6"><LpPackageSelector packages={packages} selected={selected} onSelect={setSelected} themeColor={theme} /></section>}

      <section className="grid md:grid-cols-2 gap-4">
        {features.map((f, i) => <div key={i} className="bg-white border rounded-2xl p-4 flex gap-3 shadow-sm"><span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 text-lg" style={{ background: `${theme}12` }}>{f.icon || icons[i % icons.length]}</span><div><div className="font-black">{f.title}</div>{f.text && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{f.text}</p>}</div></div>)}
      </section>

      {C.gallery_images.length > 0 && <section className="grid sm:grid-cols-2 gap-3">{C.gallery_images.map((src, i) => <img key={src + i} src={toImg(src, { w: 900, q: 82 })} alt={`${page.title} ${i + 1}`} className="w-full rounded-2xl object-cover border"/>)}</section>}

      <section className="rounded-3xl bg-white border overflow-hidden"><div className="p-5 sm:p-7"><div className="text-xs font-black uppercase tracking-widest" style={{ color: theme }}>{C.why_kicker || "আমাদের নিশ্চয়তা"}</div><h2 className="text-2xl font-black mt-1">{C.why_title || "কেন আমাদের ওপর আস্থা রাখবেন"}</h2></div><div className="grid sm:grid-cols-2 border-t">{why.map((w, i) => <div key={i} className="p-5 border-b sm:border-r flex gap-3"><span className="text-lg">{w.icon || ["💳", "🚚", "🛡️", "☎️"][i % 4]}</span><div><div className="font-black">{w.title}</div>{w.text && <p className="text-sm text-slate-500 mt-1">{w.text}</p>}</div></div>)}</div></section>

      <section className="rounded-3xl p-5 sm:p-7 text-white overflow-hidden" style={{ background: `linear-gradient(135deg, ${theme}, #0f172a)` }}><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-bold opacity-80">{C.features_kicker || "বিশেষ সুবিধা"}</div><h2 className="text-2xl sm:text-3xl font-black mt-1">{C.features_title || "আপনার জন্য বাছাই করা প্যাকেজ"}</h2></div><ShieldCheck className="w-12 h-12 opacity-80"/></div><div className="grid sm:grid-cols-3 gap-3 mt-5">{["ক্যাশ অন ডেলিভারি", "দ্রুত ডেলিভারি", "সরাসরি সাপোর্ট"].map((x, i) => <div key={x} className="rounded-2xl bg-white/10 p-4"><div className="text-xl">{["💰", "🚚", "☎️"][i]}</div><div className="font-bold mt-2">{x}</div></div>)}</div></section>

      <section className="space-y-3"><div className="text-center"><div className="text-xs font-black uppercase tracking-widest" style={{ color: theme }}>{C.reviews_kicker || "কাস্টমার ফিডব্যাক"}</div><h2 className="text-2xl font-black">{C.reviews_title || "ক্রেতারা যা বলছেন"}</h2></div><div className="grid md:grid-cols-3 gap-3">{reviews.map((r, i) => <article key={i} className="bg-white border rounded-2xl p-4"><div className="flex gap-1 text-amber-400">{Array.from({ length: Math.max(1, Math.min(5, Number(r.rating) || 5)) }).map((_, j) => <Star key={j} className="w-4 h-4 fill-current"/>)}</div><p className="text-sm leading-relaxed mt-3 text-slate-600">“{r.text}”</p><div className="font-bold text-sm mt-3">{r.name}</div></article>)}</div></section>

      <section id="lp-order" className="scroll-mt-24 space-y-3"><LpOrderNote /><LpCheckoutCard formId="lp-order-form-pro" onSubmit={submit} values={{ name: form.name, phone: form.phone, address: form.address }} onChange={(k, v) => setForm({ ...form, [k]: v })} packages={packages} selectedPkg={selected} onSelectPkg={setSelected} themeColor={theme} subtotal={subtotal} deliveryFee={shipping} total={total} submitting={submitting} submitText={C.submit_text || page.cta_text || "অর্ডার কনফার্ম করুন"} hideSubmit /></section>
    </main>
    <div className="pb-24"><Footer /></div>
    <LpFloatingCta formInView={formInView} formId="lp-order-form-pro" submitting={submitting} total={total} subtotal={subtotal} regular={regularPrice} productName={packages[selected]?.name || brand} ctaText={page.cta_text || "এখনই অর্ডার করুন"} themeColor={theme} onScrollToOrder={goOrder} />
  </div>;
}
