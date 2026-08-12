import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { Check, ShoppingCart, User, Phone, MapPin, Star, Sparkles, Leaf, Flame, Plane, BarChart3, Sprout, Wallet, Truck, ShieldCheck, Award, Headphones } from "lucide-react";
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

const DEFAULT_ICONS = [Plane, BarChart3, Sprout, Wallet, Headphones, Truck, ShieldCheck, Award];

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
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden divide-y">
      {items.map((it, i) => {
        const Icon = DEFAULT_ICONS[i % DEFAULT_ICONS.length];
        return (
          <div key={i} className="flex items-center gap-3 px-3 py-3.5 sm:px-4">
            <span
              className="grid place-items-center w-11 h-11 rounded-xl shrink-0 text-base"
              style={{ background: themeBg10, color: themeColor }}
            >
              {it.icon ? <span className="text-xl leading-none">{it.icon}</span> : <Icon className="w-5 h-5" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[15px] leading-snug">{it.title}</div>
              {it.text && <div className="text-xs text-slate-500 mt-0.5 leading-snug">{it.text}</div>}
            </div>
            <span className="grid place-items-center w-6 h-6 rounded-full shrink-0 text-emerald-600">
              <Check className="w-5 h-5" strokeWidth={3} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
  const features = asArr<Feature>(page?.features);
  const why = asArr<WhyItem>((page as { why_choose_us?: unknown } | null)?.why_choose_us);
  const reviews = asArr<Review>(page?.reviews);
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

  const ctaStyle: React.CSSProperties = {
    background: themeColor,
    ["--tw-shadow-color" as string]: themeColor,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800 pb-24" style={{ ["--lp" as string]: themeColor }}>
      <FacebookPixel eager />
      <LandingVisitTracker slug={slug} />

      {/* Editable top promo strip */}
      {topBarText && (
        <div className="text-white text-sm py-2 font-semibold tracking-wide text-center px-3" style={{ background: themeColor }}>
          <span className="inline-flex items-center gap-2 justify-center">
            <Sparkles className="w-4 h-4" />
            {topBarText}
          </span>
        </div>
      )}

      {/* Landing header (theme-color, sticky, with logo + brand) */}
      <header className="bg-white/95 backdrop-blur border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} width={40} height={40} decoding="async" className="h-10 w-10 rounded-full object-contain ring-2 ring-offset-1 bg-white" style={{ ["--tw-ring-color" as string]: themeColor }} />
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
          <button onClick={scrollToOrder} className="text-sm font-semibold rounded-full px-5 py-2 border-2 hover:shadow transition" style={{ borderColor: themeColor, color: themeColor, background: themeBg05 }}>
            অর্ডার করুন
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-8">
        {/* 1. Headline */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center leading-tight">{page.hero_title || page.title}</h1>

        {/* 2. Image */}
        <div className="relative rounded-2xl overflow-hidden border bg-white shadow-sm">
          <img src={toImg(heroImage, { w: 800, q: 80 })} srcSet={imgSrcSet(heroImage, [400, 600, 800, 1000])} sizes="(max-width: 768px) 100vw, 600px" alt={page.title} width={800} height={800} fetchPriority="high" decoding="async" className="w-full aspect-square object-cover" />
          {regular && regular > price && (
            <div className="absolute top-3 left-3 text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow" style={{ background: "#dc2626" }}>
              {Math.round(((regular - price) / regular) * 100)}% ছাড়
            </div>
          )}
        </div>

        {/* 3. CTA */}
        <div className="text-center">
          <button onClick={scrollToOrder} style={ctaStyle} className="cta-animated cta-shine inline-flex items-center justify-center gap-2 text-white font-extrabold px-8 py-3.5 rounded-full text-base">
            <ShoppingCart className="w-5 h-5" /> {cta}
          </button>
        </div>

        {/* 4. Price (legacy-style cards) */}
        {regular && regular > price ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-xl p-4 text-center bg-white">
                <div className="text-sm text-slate-500 mb-1">রেগুলার মূল্য</div>
                <div className="text-2xl font-extrabold text-slate-400 line-through">{taka(regular)}</div>
              </div>
              <div className="border-2 rounded-xl p-4 text-center shadow-sm" style={{ borderColor: themeColor, background: themeBg05 }}>
                <div className="text-sm text-slate-600 mb-1">অফার মূল্য</div>
                <div className="text-2xl font-extrabold" style={{ color: themeColor }}>{taka(price)}</div>
              </div>
            </div>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full" style={{ color: "#dc2626", background: "#fee2e2" }}>
                <Flame className="w-4 h-4" /> সাশ্রয় {taka(regular - price)} ({Math.round(((regular - price) / regular) * 100)}% ছাড়)
              </span>
            </div>
          </div>
        ) : (
          <div className="border-2 rounded-xl p-5 text-center" style={{ borderColor: themeColor, background: themeBg05 }}>
            <div className="text-sm text-slate-600 mb-1">দাম</div>
            <div className="text-3xl font-extrabold" style={{ color: themeColor }}>{taka(price)}</div>
          </div>
        )}

        {/* 5. Product features table */}
        {features.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-center mb-4">প্রোডাক্টের বৈশিষ্ট্য</h2>
            <IconRowList items={features} themeColor={themeColor} themeBg10={themeBg10} />
          </section>
        )}

        {/* 6. CTA */}
        <div className="text-center">
          <button onClick={scrollToOrder} style={ctaStyle} className="cta-animated cta-shine inline-flex items-center justify-center gap-2 text-white font-extrabold px-8 py-3.5 rounded-full text-base">
            <ShoppingCart className="w-5 h-5" /> {cta}
          </button>
        </div>

        {/* 7. Why choose us */}
        {why.length > 0 && (
          <section>
            <div className="rounded-t-2xl text-white px-4 py-3 flex items-center gap-2 font-extrabold text-lg" style={{ background: "#1e3a5f" }}>
              <ShieldCheck className="w-5 h-5" />
              কেন আমাদের ওপর আস্থা রাখবেন?
            </div>
            <div className="-mt-px">
              <IconRowList items={why} themeColor={themeColor} themeBg10={themeBg10} />
            </div>
          </section>
        )}


        {/* 8. CTA */}
        <div className="text-center">
          <button onClick={scrollToOrder} style={ctaStyle} className="cta-animated cta-shine inline-flex items-center justify-center gap-2 text-white font-extrabold px-8 py-3.5 rounded-full text-base">
            <ShoppingCart className="w-5 h-5" /> {cta}
          </button>
        </div>

        {/* 9. Reviews */}
        {reviews.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-center mb-4">কাস্টমার রিভিউ</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {reviews.map((r, i) => (
                <div key={i} className="border rounded-xl p-4 bg-white">
                  <div className="flex items-center gap-1 text-amber-500 mb-2">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="w-4 h-4" fill={k < r.rating ? "currentColor" : "none"} strokeWidth={1.5} />
                    ))}
                  </div>
                  <p className="text-sm leading-6">"{r.text}"</p>
                  <div className="text-xs font-semibold text-slate-500 mt-2">— {r.name}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9b. Package selector — above checkout */}
        {packages.length > 1 && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" style={{ color: themeColor }} />
              পণ্য সিলেক্ট করুন
            </h2>
            <div className="rounded-2xl border-2 p-3 bg-white space-y-2" style={{ borderColor: themeBg10 }}>
              {packages.map((p, i) => {
                const active = selectedPkg === i;
                return (
                  <button type="button" key={i} onClick={() => setSelectedPkg(i)}
                    className="w-full flex items-center gap-3 rounded-xl p-2.5 border-2 text-left transition"
                    style={active ? { borderColor: themeColor, background: themeBg05 } : { borderColor: "#e5e7eb", background: "#fff" }}>
                    {p.image && <img src={p.image} alt="" width={56} height={56} loading="lazy" decoding="async" className="w-14 h-14 rounded-lg object-contain bg-white shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight">{p.label}</div>
                      {p.badge && <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: themeBg10, color: themeColor }}>{p.badge}</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-extrabold" style={{ color: themeColor }}>{taka(p.price)}</div>
                      {p.old && p.old > p.price && <div className="text-xs line-through text-slate-400">{taka(p.old)}</div>}
                    </div>
                    <span className="grid place-items-center w-6 h-6 rounded-full border-2 shrink-0" style={active ? { background: themeColor, borderColor: themeColor } : { borderColor: "#d1d5db" }}>
                      {active && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 10. Checkout */}
        <section id="order" ref={orderSectionRef} className="scroll-mt-20">
          <div className="border-2 rounded-2xl overflow-hidden bg-white shadow-sm" style={{ borderColor: themeBg10 }}>
            <div className="px-4 py-3 border-b" style={{ background: themeBg05, borderColor: themeBg10 }}>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" style={{ color: themeColor }} /> অর্ডার ফর্ম
              </h2>
            </div>
            <form id="lp-order-form" onSubmit={submit} className="p-4 space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-1.5">আপনার নাম *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="আপনার নাম" className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">ফোন নম্বর *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">ঠিকানা *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="সম্পূর্ণ ঠিকানা" className="w-full border rounded-lg pl-10 pr-3 py-2.5 text-sm resize-none" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">নোট (optional)</label>
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="বিশেষ নির্দেশনা" className="w-full border rounded-lg px-3 py-2.5 text-sm" />
              </div>


              <div className="border-2 rounded-xl p-3 space-y-1.5 text-sm" style={{ borderColor: themeBg10 }}>
                <div className="flex justify-between"><span className="text-slate-600">সাবটোটাল</span><span className="font-bold" style={{ color: themeColor }}>{taka(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">ডেলিভারি</span><span className="font-bold" style={{ color: themeColor }}>{deliveryFee === 0 ? "ফ্রি" : taka(deliveryFee)}</span></div>
                <div className="border-t pt-1.5 flex justify-between text-base"><span className="font-extrabold">সর্বমোট</span><span className="font-extrabold" style={{ color: themeColor }}>{taka(total)}</span></div>
              </div>
            </form>
          </div>
        </section>
      </div>

      <Footer />

      {/* Sticky CTA — flips to "Place Order" when form is in view */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-3 py-2.5">
        <div className="container mx-auto max-w-2xl flex items-center gap-3">
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-[11px] text-slate-500">সর্বমোট</div>
            <div className="font-extrabold text-base" style={{ color: themeColor }}>{taka(total)}</div>
          </div>
          {formInView ? (
            <button
              type="submit"
              form="lp-order-form"
              disabled={submitting}
              style={ctaStyle}
              className="cta-animated cta-shine flex-1 text-white py-3.5 rounded-full font-extrabold text-base disabled:opacity-60"
            >
              {submitting ? "অর্ডার হচ্ছে..." : `✓ অর্ডার কনফার্ম করুন — ${taka(total)}`}
            </button>
          ) : (
            <button
              onClick={scrollToOrder}
              style={ctaStyle}
              className="cta-animated cta-shine flex-1 text-white py-3.5 rounded-full font-extrabold text-base flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
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
