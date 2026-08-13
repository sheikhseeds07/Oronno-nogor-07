import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { Check, ShoppingCart, User, Phone, MapPin, Star, Sparkles, Leaf, BarChart3, Sprout, Wallet, Truck, ShieldCheck, Award, Headphones, Home } from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { Footer } from "@/components/layout/Footer";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { trackVisit } from "@/lib/track-visit";
import { getFbContext } from "@/lib/fb-context";
import { toImg, imgSrcSet } from "@/lib/img";
import brandLogoFile from "@/assets/logo.jpg";

const PROMO_MESSAGES = [
  "আমাদের বীজ কিনলেই পাবেন গ্যারান্টি কার্ড",
  "বীজ থেকে চারা তৈরির সম্পূর্ণ গাইডলাইন ফ্রি",
  "সারা দেশে ক্যাশ অন হোম ডেলিভারি",
  "১০০% অরিজিনাল ও উচ্চ অংকুরোদগম হারের বীজ",
  "অর্ডারে সমস্যা হলে সরাসরি কাস্টমার সাপোর্ট",
];

type SeedRow = { name: string; qty: string };

const DEFAULT_SEEDS: SeedRow[] = [
  { name: "বিটরুট", qty: "৫ পিস" },
  { name: "কেরালা শিম", qty: "৫ পিস" },
  { name: "করলা", qty: "৫ পিস" },
  { name: "উস্তে", qty: "৫ পিস" },
  { name: "লাউ", qty: "৫ পিস" },
  { name: "শষা", qty: "২০+ পিস" },
  { name: "চিচিঙ্গা", qty: "৫ পিস" },
  { name: "মিষ্টি কুমড়া", qty: "৫ পিস" },
  { name: "মরিচ", qty: "২০+ পিস" },
  { name: "বেগুন", qty: "২০+ পিস" },
  { name: "ঢেরষ", qty: "৬৫+ বীজ" },
  { name: "বরবটি", qty: "৪০+ পিস" },
  { name: "ধুন্দল", qty: "৭+ পিস" },
  { name: "ঝিঙা", qty: "৭+ পিস" },
  { name: "চালকুমড়া", qty: "৮+ পিস" },
  { name: "ধনিয়া", qty: "৬ জিপার" },
  { name: "পালন শাক", qty: "৬ জিপার" },
  { name: "পুই শাক", qty: "৬ জিপার" },
  { name: "কলমি শাক", qty: "৬ জিপার" },
  { name: "সবুজ শাক", qty: "৬ জিপার" },
  { name: "লাল শাক", qty: "৬ জিপার" },
  { name: "ডাটা শাক", qty: "৬ জিপার" },
  { name: "সুগন্ধি শাক", qty: "৬ জিপার" },
  { name: "নাফা শাক", qty: "৬ জিপার" },
];

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
  const brandLogo = settings.logo_url || brandLogoFile;

  const ctaStyle: React.CSSProperties = { background: themeColor };
  const discount = regular && regular > price ? Math.round(((regular - price) / regular) * 100) : 0;
  const avgRating =
    reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1) : "5.0";
  const seedTable = asArr<{ name: string; qty: string }>((page as { seed_table?: unknown } | null)?.seed_table);
  const seeds = seedTable.length ? seedTable : DEFAULT_SEEDS;

  const RedCta = ({ label = "অর্ডার করতে ক্লিক করুন" }: { label?: string }) => (
    <button
      onClick={scrollToOrder}
      className="lp-red-cta w-full inline-flex items-center justify-center gap-2.5 text-white font-extrabold px-6 py-4 rounded-xl text-[17px] tracking-tight"
    >
      <ShoppingCart className="w-5 h-5 shrink-0" /> {label}
    </button>
  );

  const SectionHead = ({ kicker, title }: { kicker: string; title: string }) => (
    <div className="mb-4 text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: themeColor }}>
        {kicker}
      </div>
      <h2 className="text-[22px] sm:text-[26px] font-extrabold text-slate-900 mt-1 tracking-tight">{title}</h2>
      <span className="mt-2.5 inline-block h-1 w-14 rounded-full" style={{ background: themeColor }} />
    </div>
  );

  return (
    <div className="lp-root min-h-screen bg-[#f4faf3] text-slate-700 pb-24" style={{ ["--lp" as string]: themeColor }}>
      <FacebookPixel eager />
      <LandingVisitTracker slug={slug} />

      {/* Editable top promo strip — slow scrolling marquee */}
      <div className="bg-slate-900 text-white text-[12px] sm:text-[13px] py-2 font-medium tracking-wide overflow-hidden">
        <div className="lp-marquee">
          <div className="lp-marquee-track">
            {[0, 1].map((dup) => (
              <span key={dup} className="lp-marquee-group">
                {(topBarText ? [topBarText] : PROMO_MESSAGES).map((m: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-2 px-6">
                    <Sparkles className="w-3.5 h-3.5 lp-twinkle shrink-0" style={{ color: themeColor }} />
                    {m}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>


      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-emerald-100 sticky top-0 z-30">
        <div className="container mx-auto px-4 max-w-2xl py-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={brandLogo}
              alt={brandName}
              width={38}
              height={38}
              decoding="async"
              className="h-[38px] w-[38px] shrink-0 rounded-full object-cover ring-2 ring-emerald-100 bg-white"
            />
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-[17px] text-slate-900 tracking-tight truncate">{brandName}</div>
              {settings.tagline && <div className="text-[10px] text-slate-500 truncate hidden sm:block">{settings.tagline}</div>}
            </div>
          </div>
          <button
            onClick={scrollToOrder}
            className="shrink-0 text-[13px] font-bold rounded-lg px-4 py-2 text-white transition hover:brightness-95"
            style={ctaStyle}
          >
            অর্ডার করুন
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 max-w-2xl space-y-6">
        {/* Hero offer card */}
        <Reveal>
          <section className="lp-offer relative overflow-hidden rounded-[26px] px-5 py-7 text-center">
            <Leaf className="lp-leaf absolute -top-2 left-4 w-16 h-16 text-white/10" />
            <Sprout className="lp-leaf lp-leaf-2 absolute bottom-2 right-4 w-20 h-20 text-white/10" />
            <h1 className="relative text-[27px] sm:text-[36px] font-extrabold text-white leading-[1.3] tracking-tight drop-shadow">
              {page.hero_title || page.title}
            </h1>
            <div className="relative mt-5 inline-block">
              <div className="lp-price-pill inline-flex items-center justify-center rounded-full px-8 py-3.5">
                <span className="text-[27px] sm:text-[32px] font-extrabold text-slate-900 tracking-tight leading-none">
                  মাত্র {taka(price)}
                </span>
              </div>
              <span className="absolute -top-3 -right-3 bg-orange-600 text-white text-[10px] font-extrabold tracking-[0.14em] px-2.5 py-1.5 rounded-md shadow-lg">
                BEST OFFER
              </span>
            </div>
            {regular && regular > price && (
              <div className="relative mt-4 flex items-center justify-center gap-2.5 text-white/90">
                <span className="text-[17px] line-through text-white/60">{taka(regular)}</span>
                <span className="text-[12px] font-bold px-2.5 py-1 rounded-md bg-white/15">{discount}% ছাড়</span>
              </div>
            )}
            <div className="relative mx-auto mt-5 h-[3px] w-16 rounded-full bg-amber-300/80" />
            <p className="relative mt-4 inline-flex items-center justify-center gap-2 text-[14px] sm:text-[15px] font-medium text-white/90">
              <Home className="w-4 h-4 shrink-0 text-amber-300" /> সারা দেশে ক্যাশ অন হোম ডেলিভারি
            </p>
          </section>
        </Reveal>

        <RedCta />

        {/* Hero image */}
        <Reveal>
          <div className="rounded-2xl border-[3px] border-white bg-white overflow-hidden shadow-[0_6px_24px_-12px_rgba(6,78,59,0.35)]">
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
          </div>
          {page.hero_subtitle && (
            <p className="text-center text-[14px] text-slate-600 leading-relaxed mt-3">{page.hero_subtitle}</p>
          )}
        </Reveal>

        {/* Free gift */}
        <Reveal>
          <RedCta label="১ প্যাকেট বিদেশি বীজ ফ্রী নিন!" />
          <div className="mt-4 rounded-2xl bg-white border border-emerald-100 p-4 text-center">
            <div className="text-[20px] sm:text-[24px] font-extrabold text-emerald-800 leading-snug">
              ১ প্যাকেট <span className="text-orange-600">বিদেশি বীজ ফ্রী</span>
            </div>
            <p className="text-[13px] text-slate-500 mt-1.5">অর্ডারের সাথে বোনাস — সীমিত স্টক পর্যন্ত।</p>
            <img
              src="/landing-images/strawberry-combo.jpg"
              alt="ফ্রী বিদেশি বীজ"
              width={800}
              height={800}
              loading="lazy"
              decoding="async"
              className="mt-3 w-full rounded-xl object-cover"
            />
            <div className="grid grid-cols-2 gap-2 mt-3 text-left">
              {["১০০% অরিজিনাল ও ভেজালমুক্ত", "উচ্চ অংকুরোদগম হার", "সারা দেশে দ্রুত ডেলিভারি", "হাতে পেয়ে টাকা পরিশোধ"].map((t) => (
                <div key={t} className="flex items-start gap-1.5 rounded-lg bg-emerald-50/70 px-2.5 py-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  <span className="text-[12px] font-medium text-emerald-900 leading-snug">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Seed contents table */}
        <Reveal>
          <SectionHead kicker="প্যাকেজ কনটেন্ট" title="কম্বোতে যে যে বীজ থাকবে" />
          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            <div className="grid grid-cols-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-[14px] font-extrabold">
              <div className="px-4 py-3 text-center">বীজের নাম</div>
              <div className="px-4 py-3 text-center border-l border-white/25">পরিমাণ</div>
            </div>
            {seeds.map((s, i) => (
              <div
                key={s.name + i}
                className={`grid grid-cols-2 text-[14px] ${i % 2 ? "bg-emerald-50/70" : "bg-amber-50/50"}`}
              >
                <div className="px-4 py-2.5 text-center text-slate-700">{s.name}</div>
                <div className="px-4 py-2.5 text-center font-medium text-slate-700">{s.qty}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <RedCta />

        {/* Countdown */}
        <Reveal>
          <Countdown themeColor={themeColor} />
        </Reveal>

        {/* Features */}
        {features.length > 0 && (
          <Reveal>
            <SectionHead kicker="প্রোডাক্ট ডিটেইলস" title="কেন এই প্যাকেজটি বিশেষ" />
            <IconRowList items={features} themeColor={themeColor} themeBg10={themeBg10} />
          </Reveal>
        )}

        {/* Why choose us */}
        {why.length > 0 && (
          <Reveal>
            <SectionHead kicker="আমাদের নিশ্চয়তা" title="কেন আমাদের ওপর আস্থা রাখবেন" />
            <IconRowList items={why} themeColor={themeColor} themeBg10={themeBg10} />
            <div className="mt-4">
              <RedCta />
            </div>
          </Reveal>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <Reveal>
            <SectionHead kicker="কাস্টমার ফিডব্যাক" title="ক্রেতারা যা বলছেন" />
            <div className="flex items-center justify-center gap-2 mb-3">
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
                <div key={i} className="rounded-xl border border-emerald-100 p-4 bg-white">
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
          </Reveal>
        )}

        {/* Package selector */}
        {packages.length > 1 && (
          <Reveal>
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
                    style={active ? { borderColor: themeColor, background: themeBg05, boxShadow: `0 0 0 1px ${themeColor}` } : { borderColor: "#dcece0" }}
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
          </Reveal>
        )}

        {/* Checkout */}
        <section id="order" ref={orderSectionRef} className="scroll-mt-20">
          <SectionHead kicker={packages.length > 1 ? "ধাপ ২" : "অর্ডার"} title="ডেলিভারি তথ্য দিন" />
          <p className="text-center text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-4 py-3 mb-3 leading-relaxed">
            নিশ্চিন্তে অর্ডার করুন। অর্ডার করার পরে আমরা আপনাকে কল দিয়ে বিস্তারিত বলে কনফার্ম করবো।
          </p>
          <div className="rounded-2xl border border-emerald-100 bg-white overflow-hidden">
            <form id="lp-order-form" onSubmit={submit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">আপনার পুরো নাম *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="আপনার নাম" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">আপনার ফোন নাম্বার *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-slate-900 block mb-1.5">আপনার সম্পূর্ণ ঠিকানা *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="গ্রাম/এলাকা, থানা, জেলা" className="w-full border border-slate-200 rounded-lg pl-10 pr-3 py-2.5 text-sm resize-none bg-slate-50/60 outline-none focus:bg-white focus:border-emerald-500 transition" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm overflow-hidden">
                <div className="flex items-center gap-3 px-3.5 py-3">
                  {selected?.image && (
                    <img src={selected.image} alt="" width={44} height={44} loading="lazy" decoding="async" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                  )}
                  <span className="text-slate-600 flex-1 min-w-0 leading-snug">{selected?.name ?? "সাবটোটাল"} × ১</span>
                  <span className="font-semibold text-slate-900 shrink-0">{taka(subtotal)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-slate-500">ডেলিভারি চার্জ</span>
                  <span className="font-semibold text-slate-900">{deliveryFee === 0 ? "ফ্রি" : taka(deliveryFee)}</span>
                </div>
                <div className="flex justify-between px-3.5 py-3 bg-emerald-50/60">
                  <span className="font-bold text-slate-900">সর্বমোট</span>
                  <span className="font-bold text-[17px]" style={{ color: themeColor }}>{taka(total)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={ctaStyle}
                className={`w-full text-white py-4 rounded-xl font-extrabold text-[17px] disabled:opacity-60 transition hover:brightness-95 inline-flex items-center justify-center gap-2 shadow-lg ${formInView ? "lp-float-up" : ""}`}
              >
                <ShieldCheck className="w-[18px] h-[18px]" />
                {submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন — ${taka(total)}`}
              </button>

              <p className="text-[12px] text-slate-500 text-center leading-relaxed">
                পণ্য হাতে পেয়ে টাকা পরিশোধ করুন — ক্যাশ অন ডেলিভারি।
              </p>
            </form>
          </div>
        </section>
      </div>

      <Footer />

      {/* Sticky CTA — transforms into the confirm button at checkout */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${
          formInView
            ? "bg-gradient-to-t from-emerald-900/90 via-emerald-800/85 to-emerald-700/80 backdrop-blur px-3 py-3.5 border-t border-white/10"
            : "bg-white/95 backdrop-blur border-t border-emerald-100 px-3 py-2.5"
        }`}
      >
        <div className="container mx-auto max-w-2xl">
          {!formInView ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="leading-tight min-w-0">
                <div className="text-[12px] font-bold text-slate-900 truncate">{selected?.name ?? brandName}</div>
                <div className="flex items-baseline gap-1.5">
                  {regular && regular > price && <span className="text-[12px] line-through text-slate-400">{taka(regular)}</span>}
                  <span className="font-extrabold text-[17px]" style={{ color: themeColor }}>{taka(total)}</span>
                </div>
              </div>
              <button
                onClick={scrollToOrder}
                style={ctaStyle}
                className="lp-pulse shrink-0 text-white px-6 py-3 rounded-xl font-extrabold text-[15px] flex items-center justify-center gap-2 transition hover:brightness-95"
              >
                <ShoppingCart className="w-[18px] h-[18px]" />
                {cta}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-white/90 text-[13px]">
                <span className="font-semibold truncate pr-3">{selected?.name ?? brandName}</span>
                <span className="font-extrabold">{taka(total)}</span>
              </div>
              <button
                type="submit"
                form="lp-order-form"
                disabled={submitting}
                className="w-full bg-amber-400 text-emerald-950 py-3.5 rounded-xl font-extrabold text-[17px] disabled:opacity-60 transition hover:bg-amber-300 inline-flex items-center justify-center gap-2 shadow-lg lp-pulse"
              >
                <ShieldCheck className="w-[18px] h-[18px]" />
                {submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন — ${taka(total)}`}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setShown(true);
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} className={shown ? "lp-reveal lp-reveal-in" : "lp-reveal"}>
      {children}
    </section>
  );
}

function Countdown({ themeColor }: { themeColor: string }) {
  const [left, setLeft] = useState(3 * 3600);
  useEffect(() => {
    const KEY = "lp-offer-deadline";
    let deadline = Number(localStorage.getItem(KEY) || 0);
    if (!deadline || deadline < Date.now()) {
      deadline = Date.now() + 3 * 3600 * 1000;
      localStorage.setItem(KEY, String(deadline));
    }
    const tick = () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = [
    { v: pad(Math.floor(left / 3600)), l: "ঘণ্টা" },
    { v: pad(Math.floor((left % 3600) / 60)), l: "মিনিট" },
    { v: pad(left % 60), l: "সেকেন্ড" },
  ];
  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/70 px-4 py-5 text-center">
      <div className="text-[15px] font-bold text-slate-800">অফারটি শেষ হতে আর মাত্র...</div>
      <div className="mt-3 flex items-start justify-center gap-2">
        {parts.map((p, i) => (
          <div key={p.l} className="flex items-start gap-2">
            {i > 0 && <span className="text-[22px] font-bold text-slate-500 leading-[1.6]">:</span>}
            <div className="text-center">
              <div
                className="w-[62px] rounded-lg py-2 text-[24px] font-extrabold text-white tabular-nums leading-none"
                style={{ background: themeColor }}
              >
                {p.v}
              </div>
              <div className="mt-1.5 text-[12px] font-semibold" style={{ color: themeColor }}>{p.l}</div>
            </div>
          </div>
        ))}
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
