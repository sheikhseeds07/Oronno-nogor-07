import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { Check, ShoppingCart, User, Phone, MapPin, Star, Sparkles, Leaf, Flame, BarChart3, Sprout, Wallet, Truck, ShieldCheck, Award, Headphones } from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { Footer } from "@/components/layout/Footer";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { trackVisit } from "@/lib/track-visit";
import { getFbContext } from "@/lib/fb-context";
import { toImg, imgSrcSet } from "@/lib/img";

type Feature = { title: string; text?: string; icon?: string };
type WhyItem = { title: string; text?: string; icon?: string };
type Review = { name: string; rating: number; text: string };

const DEFAULT_ICONS = [Sprout, Leaf, ShieldCheck, Award, Wallet, Truck, Headphones, BarChart3];

function IconRowList({
  items,
  themeColor,
  themeBg10,
}: {
  items: { title: string; text?: string; icon?: string }[];
  themeColor: string;
  themeBg10: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
      {items.map((it, i) => {
        const Icon = DEFAULT_ICONS[i % DEFAULT_ICONS.length];
        return (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <span
              className="grid place-items-center w-9 h-9 rounded-lg shrink-0 mt-0.5"
              style={{ background: themeBg10, color: themeColor }}
            >
              {it.icon ? <span className="text-lg leading-none">{it.icon}</span> : <Icon className="w-[18px] h-[18px]" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] leading-snug text-slate-900">{it.title}</div>
              {it.text && <div className="text-[13px] text-slate-500 mt-1 leading-relaxed">{it.text}</div>}
            </div>
            <Check className="w-4 h-4 shrink-0 mt-1.5 text-emerald-600" strokeWidth={3} />
          </div>
        );
      })}
    </div>
  );
}

const DEFAULT_FEATURES: { title: string; text?: string }[] = [
  { title: "১০০% অরিজিনাল ও পরীক্ষিত বীজ", text: "প্রতিটি প্যাকেট উচ্চ অংকুরোদগম হারের নিশ্চয়তা সহ প্যাক করা হয়।" },
  { title: "ছাদ বাগান ও টবের জন্য উপযুক্ত", text: "অল্প জায়গাতেই সারা বছর সবজি ফলানোর জন্য বাছাই করা জাত।" },
  { title: "সব ঋতুর মিক্স কালেকশন", text: "শাক, ফল ও সবজির বৈচিত্র্যময় সংগ্রহ — একবারেই পুরো বাগান।" },
  { title: "সহজ চাষ পদ্ধতি সহ গাইড", text: "কোন বীজ কখন ও কীভাবে বুনবেন — বাংলায় নির্দেশনা।" },
];

const DEFAULT_WHY: { title: string; text?: string }[] = [
  { title: "ক্যাশ অন ডেলিভারি", text: "পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।" },
  { title: "সারা দেশে দ্রুত ডেলিভারি", text: "ঢাকায় ১–২ দিন, ঢাকার বাইরে ২–৩ দিনে পৌঁছে যাবে।" },
  { title: "মান নিশ্চয়তা", text: "প্যাকেজিং সমস্যা বা ভুল পণ্য হলে রিপ্লেসমেন্ট।" },
  { title: "সরাসরি কাস্টমার সাপোর্ট", text: "অর্ডার সংক্রান্ত যেকোনো সহায়তায় আমরা আছি।" },
];

const DEFAULT_REVIEWS: Review[] = [
  { name: "রাশেদুল ইসলাম, ঢাকা", rating: 5, text: "প্যাকেজিং খুব ভালো ছিল, প্রায় সব বীজেই চারা এসেছে। ছাদ বাগানের জন্য দুর্দান্ত।" },
  { name: "সুমাইয়া আক্তার, চট্টগ্রাম", rating: 5, text: "দাম অনুযায়ী এত প্রকার বীজ আশা করিনি। আবার অর্ডার করব ইনশাআল্লাহ।" },
  { name: "মাহবুব হাসান, রাজশাহী", rating: 4, text: "সময়মতো ডেলিভারি পেয়েছি, ডেলিভারি ম্যানের ব্যবহারও ভালো ছিল।" },
];


type Addon = {
  product_id?: string;
  name: string;
  price: number;
  image?: string;
  old_price?: number;
  badge?: string;
  delivery_fee?: number | null;
};

type SiteSettings = { site_name?: string; tagline?: string; logo_url?: string };

export function CleanLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [formInView, setFormInView] = useState(false);
  const orderSectionRef = useRef<HTMLElement | null>(null);

  const { data: page, isLoading } = useQuery({
    queryKey: ["landing-clean", slug],
    queryFn: async () =>
      (await supabase
        .from("landing_pages")
        .select("*, products(*)")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle()
      ).data,
  });

  const { data: settingsRow } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data,
  });
  const settings = (settingsRow?.settings as SiteSettings) ?? {};

  const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const product = (page?.products ?? null) as { id: string; name: string; price: number; sale_price: number | null; images: string[] | null } | null;
  const rawFeatures = asArr<Feature>(page?.features);
  const rawWhy = asArr<WhyItem>((page as { why_choose_us?: unknown } | null)?.why_choose_us);
  const rawReviews = asArr<Review>(page?.reviews);
  const features = rawFeatures.length ? rawFeatures : DEFAULT_FEATURES;
  const why = rawWhy.length ? rawWhy : DEFAULT_WHY;
  const reviews = rawReviews.length ? rawReviews : DEFAULT_REVIEWS;
  const addons = asArr<Addon>(page?.addons);


  const heroImage = page?.hero_image || product?.images?.[0] || "/placeholder.svg";
  const price = (page?.sale_price ?? product?.sale_price ?? page?.regular_price ?? product?.price ?? 0) as number;
  const regular = (page?.regular_price ?? product?.price ?? null) as number | null;
  const themeColor = (page?.theme_color as string) || "#16a34a";
  const themeBg10 = themeColor + "1A";
  const themeBg05 = themeColor + "0D";

  type Pkg = { label: string; price: number; old?: number | null; image?: string; badge?: string; product_id?: string; name: string; delivery_fee: number };
  const defaultDelivery = Number(
    (page as { main_delivery_fee?: number | null } | null)?.main_delivery_fee ??
      page?.delivery_inside ??
      70,
  );

  const packages: Pkg[] = useMemo(() => {
    const list: Pkg[] = [];
    if (product) {
      list.push({ label: product.name, name: product.name, price, old: regular, image: heroImage, product_id: product.id, delivery_fee: defaultDelivery });
    }
    addons.forEach((a) => {
      list.push({
        label: a.name, name: a.name, price: a.price, old: a.old_price, image: a.image, badge: a.badge, product_id: a.product_id,
        delivery_fee: a.delivery_fee == null ? defaultDelivery : Number(a.delivery_fee),
      });
    });
    return list;
  }, [product, addons, price, regular, heroImage, defaultDelivery]);

  const selected = packages[selectedPkg] || packages[0];
  const subtotal = selected ? selected.price : price;
  const deliveryFee = selected ? selected.delivery_fee : defaultDelivery;
  const total = subtotal + deliveryFee;

  const scrollToOrder = () => {
    orderSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const firedICRef = useRef(false);
  useEffect(() => {
    const el = orderSectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio > 0.15;
        setFormInView(visible);
        if (visible && !firedICRef.current && selected?.product_id) {
          firedICRef.current = true;
          trackInitiateCheckout(
            [{ id: selected.product_id, name: selected.name, price: selected.price, quantity: 1 }],
            total,
          );
        }
      },
      { threshold: [0, 0.15, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [selected?.product_id, selected?.name, selected?.price, total]);

  // Auto-fill + save incomplete order
  useCheckoutAutofill({
    form,
    setForm: (updater) => setForm((f) => updater(f) as typeof f),
    items: selected
      ? [{ id: selected.product_id || `addon-${selectedPkg}`, name: selected.name, price: selected.price, quantity: 1 }]
      : [],
    subtotal,
    total,
    deliveryFee,
  });


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) return toast.error("সব তথ্য পূরণ করুন");
    if (!selected) return toast.error("প্যাকেজ নির্বাচন করুন");
    setSubmitting(true);
    try {
      const itemId = selected.product_id || `addon-${selectedPkg}`;
      const items = [{ id: itemId, name: selected.name, price: selected.price, quantity: 1 }];
      const fbCtx = getFbContext();
      const order = await runPlaceOrder({
        data: {
          customer_name: form.name,
          customer_phone: form.phone.replace(/[\s-]/g, ""),
          customer_address: form.address,
          delivery_fee: deliveryFee,
          items,
          notes: form.note || null,
          ...fbCtx,
        },
      });
      trackPurchase(items.map((i) => ({ id: String(i.id), name: i.name, price: i.price, quantity: i.quantity })), total, order.id);
      toast.success("অর্ডার সফল!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "অর্ডার করতে সমস্যা হয়েছে");
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><BrandLoader /></div>;
  if (!page) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">পেজ পাওয়া যায়নি</div>;

  const topBarText = (page as { top_bar_text?: string }).top_bar_text;
  const cta = page.cta_text || "অর্ডার করুন";
  const brandName = settings.site_name || "অরন্য নগর";
  const brandLogo = settings.logo_url;

  const ctaStyle: React.CSSProperties = { background: themeColor };
  const discount = regular && regular > price ? Math.round(((regular - price) / regular) * 100) : 0;
  const avgRating =
    reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1) : "5.0";

  const PrimaryCta = ({ label }: { label: string }) => (
    <button
      onClick={scrollToOrder}
      style={ctaStyle}
      className="w-full inline-flex items-center justify-center gap-2 text-white font-bold px-6 py-3.5 rounded-xl text-[15px] shadow-sm transition hover:brightness-95 active:scale-[0.99]"
    >
      <ShoppingCart className="w-[18px] h-[18px]" /> {label}
    </button>
  );

  const SectionHead = ({ kicker, title }: { kicker: string; title: string }) => (
    <div className="mb-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: themeColor }}>
        {kicker}
      </div>
      <h2 className="text-[22px] sm:text-2xl font-bold text-slate-900 mt-1 tracking-tight">{title}</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 pb-24" style={{ ["--lp" as string]: themeColor }}>
      <FacebookPixel eager />
      <LandingVisitTracker slug={slug} />

      {/* Editable top promo strip */}
      {topBarText && (
        <div className="bg-slate-900 text-white text-[12px] sm:text-[13px] py-2 font-medium tracking-wide text-center px-3">
          <span className="inline-flex items-center gap-2 justify-center">
            <Sparkles className="w-3.5 h-3.5" style={{ color: themeColor }} />
            {topBarText}
          </span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 max-w-2xl py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} width={36} height={36} decoding="async" className="h-9 w-9 rounded-full object-contain bg-white" />
            ) : (
              <div className="h-9 w-9 rounded-full grid place-items-center text-white" style={{ background: themeColor }}>
                <Leaf className="w-[18px] h-[18px]" />
              </div>
            )}
            <div className="leading-tight">
              <div className="font-bold text-[17px] text-slate-900 tracking-tight">{brandName}</div>
              {settings.tagline && <div className="text-[10px] text-slate-500 hidden sm:block">{settings.tagline}</div>}
            </div>
          </div>
          <button
            onClick={scrollToOrder}
            className="text-[13px] font-semibold rounded-lg px-4 py-2 text-white transition hover:brightness-95"
            style={ctaStyle}
          >
            অর্ডার করুন
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-7">
        {/* Hero */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 pt-5 text-center">
            {discount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1 rounded-full" style={{ background: themeBg10, color: themeColor }}>
                <Flame className="w-3.5 h-3.5" /> সীমিত সময়ের অফার
              </span>
            )}
            <h1 className="text-[26px] sm:text-[32px] font-bold text-slate-900 leading-[1.25] tracking-tight mt-3">
              {page.hero_title || page.title}
            </h1>
            {page.hero_subtitle && (
              <p className="text-[14px] text-slate-500 leading-relaxed mt-2.5">{page.hero_subtitle}</p>
            )}
          </div>

          <div className="relative mt-5">
            <img
              src={toImg(heroImage, { w: 900, q: 82 })}
              srcSet={imgSrcSet(heroImage, [400, 600, 800, 1000])}
              sizes="(max-width: 768px) 100vw, 640px"
              alt={page.title}
              width={900}
              height={900}
              fetchPriority="high"
              decoding="async"
              className="w-full aspect-square object-cover"
            />
            {discount > 0 && (
              <div className="absolute top-3 left-3 bg-slate-900/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg backdrop-blur">
                {discount}% ছাড়
              </div>
            )}
          </div>

          {/* Price */}
          <div className="p-5 space-y-4">
            <div className="flex items-end justify-center gap-3 flex-wrap">
              <div className="text-[34px] font-bold leading-none tracking-tight" style={{ color: themeColor }}>
                {taka(price)}
              </div>
              {regular && regular > price && (
                <>
                  <div className="text-[18px] text-slate-400 line-through leading-none pb-1">{taka(regular)}</div>
                  <span className="text-[12px] font-semibold px-2.5 py-1 rounded-md text-rose-700 bg-rose-50 leading-none">
                    সাশ্রয় {taka(regular - price)}
                  </span>
                </>
              )}
            </div>
            <PrimaryCta label={cta} />
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { icon: Wallet, label: "ক্যাশ অন ডেলিভারি" },
                { icon: Truck, label: "সারা দেশে ডেলিভারি" },
                { icon: ShieldCheck, label: "অরিজিনাল পণ্য" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center rounded-xl bg-slate-50 border border-slate-100 py-3 px-1.5">
                  <Icon className="w-[18px] h-[18px]" style={{ color: themeColor }} />
                  <span className="text-[11px] font-medium text-slate-600 leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        {features.length > 0 && (
          <section>
            <SectionHead kicker="প্রোডাক্ট ডিটেইলস" title="কেন এই প্যাকেজটি বিশেষ" />
            <IconRowList items={features} themeColor={themeColor} themeBg10={themeBg10} />
          </section>
        )}

        {/* Why choose us */}
        {why.length > 0 && (
          <section>
            <SectionHead kicker="আমাদের নিশ্চয়তা" title="কেন আমাদের ওপর আস্থা রাখবেন" />
            <IconRowList items={why} themeColor={themeColor} themeBg10={themeBg10} />
            <div className="mt-4">
              <PrimaryCta label={cta} />
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <SectionHead kicker="কাস্টমার ফিডব্যাক" title="ক্রেতারা যা বলছেন" />
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <span className="text-[13px] font-semibold text-slate-900">{avgRating}</span>
              <span className="text-[13px] text-slate-500">({reviews.length} রিভিউ)</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {reviews.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center gap-0.5 text-amber-500 mb-2">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="w-3.5 h-3.5" fill={k < r.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                    ))}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-slate-600">{r.text}</p>
                  <div className="text-[12px] font-semibold text-slate-900 mt-3">— {r.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Package selector */}
        {packages.length > 1 && (
          <section>
            <SectionHead kicker="ধাপ ১" title="প্যাকেজ নির্বাচন করুন" />
            <div className="space-y-2">
              {packages.map((p, i) => {
                const active = selectedPkg === i;
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedPkg(i)}
                    className="w-full flex items-center gap-3 rounded-xl p-3 border text-left transition bg-white"
                    style={active ? { borderColor: themeColor, background: themeBg05, boxShadow: `0 0 0 1px ${themeColor}` } : { borderColor: "#e2e8f0" }}
                  >
                    {p.image && (
                      <img src={p.image} alt="" width={52} height={52} loading="lazy" decoding="async" className="w-[52px] h-[52px] rounded-lg object-cover bg-slate-50 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] leading-snug text-slate-900">{p.label}</div>
                      {p.badge && (
                        <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: themeBg10, color: themeColor }}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-[15px] text-slate-900">{taka(p.price)}</div>
                      {p.old && p.old > p.price && <div className="text-[11px] line-through text-slate-400">{taka(p.old)}</div>}
                    </div>
                    <span
                      className="grid place-items-center w-5 h-5 rounded-full border-2 shrink-0"
                      style={active ? { background: themeColor, borderColor: themeColor } : { borderColor: "#cbd5e1" }}
                    >
                      {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Checkout */}
        <section id="order" ref={orderSectionRef} className="scroll-mt-20">
          <SectionHead kicker={packages.length > 1 ? "ধাপ ২" : "অর্ডার"} title="ডেলিভারি তথ্য দিন" />
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <form id="lp-order-form" onSubmit={submit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">আপনার নাম *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="আপনার নাম" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-slate-400 transition" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">ফোন নম্বর *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-slate-400 transition" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">ঠিকানা *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="গ্রাম/এলাকা, থানা, জেলা" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm resize-none bg-slate-50/60 outline-none focus:bg-white focus:border-slate-400 transition" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm overflow-hidden">
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-slate-500">{selected?.name ?? "সাবটোটাল"}</span>
                  <span className="font-semibold text-slate-900">{taka(subtotal)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-slate-500">ডেলিভারি চার্জ</span>
                  <span className="font-semibold text-slate-900">{deliveryFee === 0 ? "ফ্রি" : taka(deliveryFee)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-3 bg-slate-50">
                  <span className="font-bold text-slate-900">সর্বমোট</span>
                  <span className="font-bold text-[17px]" style={{ color: themeColor }}>{taka(total)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={ctaStyle}
                className="w-full text-white py-3.5 rounded-xl font-bold text-[15px] disabled:opacity-60 transition hover:brightness-95"
              >
                {submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন — ${taka(total)}`}
              </button>
              <p className="text-[12px] text-slate-500 text-center leading-relaxed">
                অর্ডার করার পর আমাদের প্রতিনিধি ফোনে কনফার্ম করবেন। পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।
              </p>
            </form>
          </div>
        </section>
      </div>

      <Footer />

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-2.5">
        <div className="container mx-auto max-w-2xl flex items-center gap-3">
          <div className="leading-tight shrink-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">সর্বমোট</div>
            <div className="font-bold text-[15px] text-slate-900">{taka(total)}</div>
          </div>
          {formInView ? (
            <button
              type="submit"
              form="lp-order-form"
              disabled={submitting}
              style={ctaStyle}
              className="flex-1 text-white py-3 rounded-xl font-bold text-[15px] disabled:opacity-60 transition hover:brightness-95"
            >
              {submitting ? "অর্ডার হচ্ছে..." : "অর্ডার কনফার্ম করুন"}
            </button>
          ) : (
            <button
              onClick={scrollToOrder}
              style={ctaStyle}
              className="flex-1 text-white py-3 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 transition hover:brightness-95"
            >
              <ShoppingCart className="w-[18px] h-[18px]" />
              {cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


function LandingVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackVisit(`/landing/${slug}`);
  }, [slug]);
  return null;
}
