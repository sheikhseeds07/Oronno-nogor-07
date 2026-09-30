import { SafeImage } from "@/components/SafeImage";
import { LANDING_PAGES_COLUMNS, PRODUCTS_COLUMNS } from "@/lib/read-columns";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka, bnDigits } from "@/lib/format";
import { toast } from "sonner";
import { notifyOrderError } from "@/lib/order-block";
import { Check, ShoppingCart, Flame, ChevronLeft, ChevronRight, Truck, ShieldCheck, Clock, Sprout, Award, Leaf, Star } from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { Footer } from "@/components/layout/Footer";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { trackVisit } from "@/lib/track-visit";
import { getFbContext } from "@/lib/fb-context";
import { toImg, imgSrcSet } from "@/lib/img";
import { LP_SHARED_STYLE, LpHeaderCountdown, LpFloatingCta, LpOrderNote, LpCheckoutCard } from "@/components/landing/lp-shared";


type Feature = { icon?: string; title: string; text?: string };
type Review = { name: string; rating: number; text: string; image?: string };
type FaqItem = { q: string; a: string };
type Addon = { product_id?: string; name: string; price: number; image?: string; badge?: string; old_price?: number };
type Seed = { name: string; count?: string; image?: string };


type SiteSettings = {
  site_name?: string; tagline?: string; phone?: string; email?: string;
  facebook?: string; messenger?: string; whatsapp?: string;
  logo_url?: string; youtube?: string; tiktok?: string;
};

export function LegacyLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();

  const runPlaceOrder = useServerFn(placeOrder);
  const [submitting, setSubmitting] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [showAlt, setShowAlt] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", alt_phone: "", note: "" });
  const [formInView, setFormInView] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const orderSectionRef = useRef<HTMLElement | null>(null);

  const { data: page, isLoading } = useQuery({
    queryKey: ["landing", slug],
    queryFn: async () => (await supabase.from("landing_pages").select(`${LANDING_PAGES_COLUMNS}, products(${PRODUCTS_COLUMNS})`).eq("slug", slug).eq("is_published", true).maybeSingle()).data,
  });

  const { data: settingsRow } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data,
  });
  const settings = (settingsRow?.settings as SiteSettings) ?? {};

  const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const product = (page?.products ?? null) as { id: string; name: string; price: number; sale_price: number | null; stock: number; images: string[] | null } | null;
  const features = asArr<Feature>(page?.features);
  const faq = asArr<FaqItem>(page?.faq);
  const reviews = asArr<Review>(page?.reviews);
  const addons = asArr<Addon>(page?.addons);
  const seeds = asArr<Seed>((page as { seeds_list?: unknown } | null)?.seeds_list);
  
  const guaranteeText = (page as { guarantee_text?: string } | null)?.guarantee_text || "";

  const gallery: string[] = useMemo(() => {
    const g = asArr<string>(page?.gallery_images);
    const out = [page?.hero_image, ...g].filter(Boolean) as string[];
    return out.length ? out : ["/placeholder.svg"];
  }, [page]);

  const themeColor = (page?.theme_color as string) || "#15803d";
  const price = (page?.sale_price ?? product?.sale_price ?? page?.regular_price ?? product?.price ?? 0) as number;
  const regular = (page?.regular_price ?? product?.price ?? null) as number | null;
  // Single nationwide delivery (admin-editable via landing_pages.delivery_inside, default 70)
  const deliveryFee = Number(page?.delivery_inside ?? 70);

  // Build package options: main product first, then each addon as alternative pack
  const packages = useMemo(() => {
    const list: { label: string; price: number; old?: number | null; image?: string; badge?: string; product_id?: string; name: string }[] = [];
    if (product) list.push({ label: product.name, name: product.name, price, old: regular, image: gallery[0], product_id: product.id });
    addons.forEach((a) => list.push({ label: a.name, name: a.name, price: a.price, old: a.old_price, image: a.image, badge: a.badge, product_id: a.product_id }));
    return list;
  }, [product, addons, price, regular, gallery]);

  const selected = packages[selectedPkg] || packages[0];
  const subtotal = selected ? selected.price : 0;
  const total = subtotal + deliveryFee;

  // Global site pixel handles tracking — see <FacebookPixel eager /><style>{LP_SHARED_STYLE}</style> below.


  // Detect when the order form is in view → sticky CTA flips to "Place Order"
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
      { threshold: [0, 0.15, 0.5, 1] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [page?.id, selected?.product_id, selected?.name, selected?.price, total]);

  // Auto-slide gallery every 2 seconds
  useEffect(() => {
    if (gallery.length < 2) return;
    const t = setInterval(() => setActiveImg((i) => (i + 1) % gallery.length), 2000);
    return () => clearInterval(t);
  }, [gallery.length]);

  // Auto-slide customer reviews
  const reviewsArr = asArr<Review>(page?.reviews);
  useEffect(() => {
    if (reviewsArr.length < 2) return;
    const t = setInterval(() => setReviewIdx((i) => (i + 1) % reviewsArr.length), 4000);
    return () => clearInterval(t);
  }, [reviewsArr.length]);

  // Auto-fill from previous orders / localStorage + save incomplete order
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


  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><BrandLoader /></div>;
  if (!page) return <div className="min-h-screen flex items-center justify-center">পেজ পাওয়া যায়নি</div>;

  const brandName = settings.site_name || "Sheikh Seeds";
  const brandLogo = settings.logo_url;

  const scrollToOrder = () => {
    const el = document.getElementById("order");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address) return toast.error("সব তথ্য পূরণ করুন");
    if (!selected) return toast.error("প্যাকেজ নির্বাচন করুন");
    setSubmitting(true);
    try {
      const itemId = selected.product_id || `addon-${selectedPkg}`;
      const items = [{ id: itemId, name: selected.name, price: selected.price, quantity: 1 }];
      const noteParts: string[] = [];
      if (form.alt_phone) noteParts.push("বিকল্প: " + form.alt_phone);
      if (form.note) noteParts.push(form.note);
      noteParts.push("সারাদেশে হোম ডেলিভারি");
      const fbCtx = getFbContext();
      const order = await runPlaceOrder({
        data: {
          customer_name: form.name,
          customer_phone: form.phone.replace(/[\s-]/g, ""),
          customer_address: form.address,
          delivery_fee: deliveryFee,
          items,
          notes: noteParts.join(" | "),
          ...fbCtx,
        },
      });
      trackPurchase(
        items.map((i) => ({ id: String(i.id), name: i.name, price: i.price, quantity: i.quantity })),
        total,
        order.id,
      );
      toast.success("অর্ডার সফল!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (err) {
      notifyOrderError(err);
      setSubmitting(false);
    }
  };

  const themeBg10 = themeColor + "1A";
  const themeBg05 = themeColor + "0D";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800 pb-24" style={{ ["--lp" as string]: themeColor }}>
      <FacebookPixel eager />
      <LegacyVisitTracker slug={slug} />
      {/* Top promo bar — sliding marquee */}
      <div className="text-white text-sm py-2 font-semibold tracking-wide overflow-hidden marquee-pause" style={{ background: themeColor }}>
        <div className="flex whitespace-nowrap animate-marquee" style={{ animationDuration: "22s" }}>
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center gap-8 px-6">
              <span>🚚 সারাদেশে হোম ডেলিভারি মাত্র {bnDigits(deliveryFee)} টাকা</span>
              <span>•</span>
              <span>🛡️ বীজ কিনলে পাবেন গ্যারান্টি কার্ড</span>
              <span>•</span>
              <span>🌱 ফ্রি বীজ থেকে চারা তৈরির গাইডলাইন</span>
              <span>•</span>
              <span>⚡ ২-৩ দিনে ডেলিভারি</span>
              <span>•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/95 backdrop-blur border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <SafeImage src={toImg(brandLogo)} alt={brandName} width={40} height={40} decoding="async" className="h-10 w-10 rounded-full object-contain ring-2 ring-offset-1 bg-white" style={{ ["--tw-ring-color" as string]: themeColor }} />
            ) : (
              <div className="h-10 w-10 rounded-full grid place-items-center text-white shadow" style={{ background: themeColor }}>
                <Leaf className="w-5 h-5" />
              </div>
            )}
            <div className="leading-tight">
              <div className="font-extrabold text-xl" style={{ color: themeColor }}>{brandName}</div>
              {settings.tagline && <div className="text-[10px] text-slate-500 font-medium hidden sm:block">{settings.tagline}</div>}
            </div>
          </div>
          <LpHeaderCountdown hours={3} />
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-6 pb-4 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-extrabold text-center leading-snug mb-4">{page.hero_title || page.title}</h1>

        {/* Image carousel */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-100 border shadow-sm">
          <SafeImage src={toImg(gallery[activeImg], { w: 800, q: 80 })} srcSet={imgSrcSet(gallery[activeImg], [400, 600, 800, 1000])} sizes="(max-width: 768px) 100vw, 600px" alt={page.title} width={800} height={800} fetchPriority="high" decoding="async" className="w-full aspect-square object-cover" />
          {gallery.length > 1 && (
            <>
              <button onClick={() => setActiveImg((activeImg - 1 + gallery.length) % gallery.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 grid place-items-center shadow hover:scale-105 transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => setActiveImg((activeImg + 1) % gallery.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 grid place-items-center shadow hover:scale-105 transition">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          {regular && regular > price && (
            <div className="absolute top-3 left-3 text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow" style={{ background: "#dc2626" }}>
              {Math.round(((regular - price) / regular) * 100)}% ছাড়
            </div>
          )}
        </div>
        {gallery.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {gallery.map((_, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className="h-1.5 rounded-full transition-all" style={{ width: activeImg === i ? 24 : 8, background: activeImg === i ? themeColor : "#d1d5db" }} />
            ))}
          </div>
        )}

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { icon: Truck, t: "ফ্রি ডেলিভারি ট্র্যাকিং" },
            { icon: ShieldCheck, t: "১০০% অরিজিনাল" },
            { icon: Clock, t: "দ্রুত ডেলিভারি" },
          ].map((b, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-1 py-2 rounded-xl" style={{ background: themeBg05 }}>
              <b.icon className="w-5 h-5" style={{ color: themeColor }} />
              <span className="text-[11px] font-semibold leading-tight">{b.t}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-sm mt-4 text-slate-600">
          সারাদেশে হোম ডেলিভারি মাত্র <span className="font-bold" style={{ color: themeColor }}>{bnDigits(deliveryFee)} টাকা</span>
        </p>

        <button onClick={scrollToOrder} className="mt-3 w-full text-white font-bold py-3.5 rounded-full text-lg shadow-md hover:shadow-lg active:scale-[0.99] transition" style={{ background: themeColor }}>
          {page.cta_text || "অর্ডার করতে ক্লিক করুন"}
        </button>

        {/* Price cards */}
        {regular && regular > price && (
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="border rounded-xl p-4 text-center bg-white">
              <div className="text-sm text-slate-500 mb-1">রেগুলার মূল্য</div>
              <div className="text-2xl font-extrabold text-slate-400 line-through">{taka(regular)}</div>
            </div>
            <div className="border-2 rounded-xl p-4 text-center shadow-sm" style={{ borderColor: themeColor, background: themeBg05 }}>
              <div className="text-sm text-slate-600 mb-1">অফার মূল্য</div>
              <div className="text-2xl font-extrabold" style={{ color: themeColor }}>{taka(price)}</div>
            </div>
          </div>
        )}

        {regular && regular > price && (
          <div className="flex justify-center mt-4">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full" style={{ color: "#dc2626", background: "#fee2e2" }}>
              <Flame className="w-4 h-4" /> সাশ্রয় {taka(regular - price)} ({Math.round(((regular - price) / regular) * 100)}% ছাড়)
            </span>
          </div>
        )}
      </section>

      {/* Description */}
      {page.description && (
        <section className="container mx-auto px-4 max-w-2xl pb-2">
          <p className="text-base leading-7 whitespace-pre-line">{page.description}</p>
        </section>
      )}

      {/* Features */}
      {page.show_features !== false && features.length > 0 && (
        <section className="container mx-auto px-4 max-w-2xl py-4 space-y-2.5">
          {features.map((f, i) => (
            <div key={i} className="border-2 rounded-xl px-4 py-3.5 flex items-start gap-2 bg-white" style={{ borderColor: themeBg10 }}>
              <span className="inline-grid place-items-center w-6 h-6 rounded shrink-0 mt-0.5 text-white text-xs" style={{ background: themeColor }}>
                <Check className="w-4 h-4" />
              </span>
              <div className="flex-1">
                <div className="font-semibold">{f.title}</div>
                {f.text && <div className="text-sm text-slate-600 mt-0.5">{f.text}</div>}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Seeds list (e.g. ২৪ প্রকার সবজির বীজ) */}
      {seeds.length > 0 && (
        <section className="container mx-auto px-4 max-w-2xl py-5">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sprout className="w-5 h-5" style={{ color: themeColor }} />
            <h2 className="text-xl font-extrabold text-center">এই প্যাকেজে যা যা থাকছে</h2>
          </div>
          <div className="rounded-2xl border-2 overflow-hidden bg-white shadow-sm" style={{ borderColor: themeBg10 }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: themeBg10 }}>
              {seeds.map((s, i) => (
                <div key={i} className="bg-white p-3 flex items-center gap-2.5">
                  {s.image ? (
                    <SafeImage src={toImg(s.image, { w: 80, q: 70 })} alt={s.name} width={40} height={40} loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold shrink-0" style={{ background: themeColor }}>
                      {bnDigits(i + 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm leading-tight truncate">{s.name}</div>
                    {s.count && <div className="text-[11px] text-slate-500">{s.count}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 text-center">
            <button onClick={scrollToOrder} className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3 rounded-full shadow hover:shadow-lg active:scale-[0.99] transition" style={{ background: themeColor }}>
              <ShoppingCart className="w-4 h-4" /> এই প্যাকেজটি অর্ডার করুন
            </button>
          </div>
        </section>
      )}

      {/* Guarantee card */}
      <section className="container mx-auto px-4 max-w-2xl py-5">
        <div className="relative rounded-2xl border-2 shadow-md overflow-hidden bg-white animate-fade-in" style={{ borderColor: themeColor }}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10" style={{ background: themeColor }} />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full opacity-5" style={{ background: themeColor }} />
          <div className="relative p-5">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-14 h-14 rounded-full text-white shrink-0 shadow-md" style={{ background: themeColor }}>
                <Award className="w-7 h-7" />
              </span>
              <div className="flex-1">
                <div className="font-extrabold text-lg" style={{ color: themeColor }}>গ্যারান্টি কার্ড</div>
                <p className="text-sm leading-7 mt-1.5 text-slate-700">
                  {guaranteeText || "প্রতিটি প্যাকেজের সাথে অরিজিনাল গ্যারান্টি কার্ড পাবেন। বীজ অরিজিনাল না হলে সম্পূর্ণ টাকা ফেরত।"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: themeBg10, color: themeColor }}>
                    <ShieldCheck className="w-3.5 h-3.5" /> অরিজিনাল গ্যারান্টি কার্ড
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: themeBg10, color: themeColor }}>
                    <Sprout className="w-3.5 h-3.5" /> ফ্রি চারা তৈরির গাইডলাইন
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-3 leading-6">
                  📦 প্যাকেজের সাথে <span className="font-semibold" style={{ color: themeColor }}>বীজ থেকে চারা তৈরির সহজ গাইডলাইন</span> ও <span className="font-semibold" style={{ color: themeColor }}>গ্যারান্টি কার্ড</span> দেওয়া হবে।
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <button onClick={scrollToOrder} className="inline-flex items-center justify-center gap-2 text-white font-bold px-7 py-3 rounded-full shadow hover:shadow-lg active:scale-[0.99] transition" style={{ background: themeColor }}>
            <Sprout className="w-4 h-4" /> এখনই অর্ডার করে গ্যারান্টি কার্ড নিন
          </button>
        </div>
      </section>


      {/* Reviews — auto-sliding carousel */}
      {page.show_reviews !== false && reviews.length > 0 && (
        <section className="container mx-auto px-4 max-w-2xl py-6">
          <h2 className="text-xl font-extrabold text-center mb-1">কাস্টমার রিভিউ</h2>
          <p className="text-center text-xs text-slate-500 mb-4">সন্তুষ্ট কাস্টমারদের মতামত</p>
          <div className="relative overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: themeBg10 }}>
            <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${reviewIdx * 100}%)` }}>
              {reviews.map((r, i) => (
                <div key={i} className="w-full shrink-0 p-5">
                  <div className="flex items-center gap-1 text-amber-500 mb-2">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="w-4 h-4" fill={k < r.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                    ))}
                  </div>
                  <p className="text-sm leading-7 text-slate-700">"{r.text}"</p>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <span className="grid place-items-center w-8 h-8 rounded-full text-white text-xs font-bold" style={{ background: themeColor }}>
                      {r.name.charAt(0)}
                    </span>
                    <div className="text-sm font-semibold text-slate-700">{r.name}</div>
                  </div>
                </div>
              ))}
            </div>
            {reviews.length > 1 && (
              <div className="flex justify-center gap-1.5 pb-3">
                {reviews.map((_, i) => (
                  <button key={i} onClick={() => setReviewIdx(i)} aria-label={`review-${i}`} className="h-1.5 rounded-full transition-all" style={{ width: reviewIdx === i ? 22 : 7, background: reviewIdx === i ? themeColor : "#d1d5db" }} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FAQ */}
      {page.show_faq !== false && faq.length > 0 && (
        <section className="container mx-auto px-4 max-w-2xl py-4">
          <h2 className="text-xl font-extrabold text-center mb-4">সাধারণ প্রশ্ন</h2>
          <div className="space-y-2">
            {faq.map((f, i) => (
              <details key={i} className="border-2 rounded-xl overflow-hidden bg-white" style={{ borderColor: themeBg10 }}>
                <summary className="px-4 py-3 cursor-pointer font-semibold list-none flex justify-between items-center">
                  <span className="text-sm">{f.q}</span>
                  <span className="text-lg font-bold" style={{ color: themeColor }}>+</span>
                </summary>
                <div className="px-4 pb-3 text-sm text-slate-600 border-t pt-3 leading-6">{f.a}</div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Order Form */}
      <section id="order" ref={orderSectionRef} className="pt-2 pb-5 scroll-mt-20">
        <div className="container mx-auto px-4 max-w-2xl space-y-3">
          <LpOrderNote />
          <LpCheckoutCard formId="lp-order-form" onSubmit={submit} values={{ name: form.name, phone: form.phone, address: form.address }} onChange={(k, v) => setForm({ ...form, [k]: v })} packages={packages} selectedPkg={selectedPkg} onSelectPkg={setSelectedPkg} themeColor={themeColor} subtotal={subtotal} deliveryFee={deliveryFee} total={total} submitting={submitting} packageTitle="পণ্য সিলেক্ট করুন" />
        </div>
      </section>


      {/* CTA strip above footer */}
      <div className="container mx-auto px-4 max-w-3xl pt-10">
        <div className="rounded-2xl border bg-gradient-to-br from-white to-slate-50 p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 shadow-lg">
          <div className="flex-1 text-center sm:text-left">
            <div className="text-lg sm:text-xl font-extrabold leading-snug">
              আজই অর্ডার করুন — <span style={{ color: themeColor }}>২-৩ দিনে</span> ডেলিভারি
            </div>
            <div className="text-xs sm:text-sm text-slate-600 mt-1">সারাদেশে হোম ডেলিভারি + গ্যারান্টি কার্ড + চারা তৈরির গাইডলাইন</div>
          </div>
          <button onClick={scrollToOrder} className="text-white font-extrabold px-6 py-3 rounded-full shadow-lg hover:shadow-2xl active:scale-[0.98] transition flex items-center gap-2 whitespace-nowrap" style={{ background: themeColor }}>
            <ShoppingCart className="w-4 h-4" /> অর্ডার করুন
          </button>
        </div>
      </div>

      <Footer />

      {/* Sticky CTA — flips to "Place Order" when form is in view */}
      <LpFloatingCta formInView={formInView} formId="lp-order-form" submitting={submitting} total={total} subtotal={subtotal} regular={null} productName={selected?.label || brandName} ctaText={page.cta_text || "এখনই অর্ডার করুন"} themeColor={themeColor} onScrollToOrder={scrollToOrder} />
    </div>
  );
}

function LegacyVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackVisit(`/landing/${slug}`);
  }, [slug]);
  return null;
}
