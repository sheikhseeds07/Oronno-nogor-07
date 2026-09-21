import { useEffect, useMemo, useState, useRef, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBag, Sparkles, Truck, User, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { notifyOrderError } from "@/lib/order-block";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { getFbContext } from "@/lib/fb-context";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { mergeContent, DEFAULT_FEATURES, DEFAULT_WHY, type Feature, type WhyItem } from "@/lib/landing-content";
import { toImg, imgFallback } from "@/lib/img";
import { isValidBdPhone, phoneSubmitError } from "@/lib/bd-phone";
import { Button } from "@/components/ui/button";
import brandLogoFile from "@/assets/logo.jpg";
import { GuaranteePopup } from "@/components/landing/GuaranteePopup";

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; badge?: string; delivery_fee?: number | null };
type Page = { id: string; slug: string; title: string; top_bar_text?: string | null; hero_title?: string | null; hero_subtitle?: string | null; hero_image?: string | null; cta_text?: string | null; regular_price?: number | null; sale_price?: number | null; main_delivery_fee?: number | null; features?: Feature[] | null; why_choose_us?: WhyItem[] | null; addons?: Addon[] | null; theme_color?: string | null; planting_steps?: unknown; description?: string | null; is_published?: boolean; products?: Product | null };
type Offer = { name: string; price: number; old?: number | null; image?: string; product_id?: string; delivery_fee: number; badge?: string; quantity?: string };

export function AllProductLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const [selected, setSelected] = useState<string | null>(null);
  const [offerPopupOpen, setOfferPopupOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formInView, setFormInView] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  // The route loader already fetched this row fresh on the server for this very
  // request, so hydration must not spend the visitor's bandwidth re-fetching it.
  const { data: page, isLoading } = useQuery({ queryKey: ["landing-all-product", slug], staleTime: 30_000, queryFn: async () => (await supabase.from("landing_pages").select("*, products(id,name,price,sale_price,images)").eq("slug", slug).eq("is_published", true).maybeSingle()).data as Page | null });
  const { data: settingsRow } = useQuery({ queryKey: ["site-settings-public"], staleTime: 300_000, queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data });
  const settings = (settingsRow?.settings as { site_name?: string; tagline?: string; logo_url?: string }) ?? {};
  const product = page?.products ?? null;
  const C = mergeContent(page?.planting_steps);
  const heroImage = page?.hero_image || product?.images?.[0] || "/placeholder.svg";
  const basePrice = Number(page?.sale_price ?? product?.sale_price ?? page?.regular_price ?? product?.price ?? 0);
  const regularPrice = Number(page?.regular_price ?? product?.price ?? 0) || null;
  const delivery = Number(page?.main_delivery_fee ?? 70);
  const offers = useMemo<Offer[]>(() => {
    const main = product ? [{ name: product.name, price: basePrice, old: regularPrice, image: heroImage, product_id: product.id, delivery_fee: delivery, badge: "জনপ্রিয়" }] : [];
    const addons = (page?.addons ?? []).map((item) => ({
      name: item.name,
      price: Number(item.price),
      old: item.old_price,
      image: item.image,
      product_id: item.product_id,
      delivery_fee: item.delivery_fee == null ? delivery : Number(item.delivery_fee),
      badge: item.badge,
    }));
    // The configured main product must appear only once. Some legacy landing
    // pages also contain that same product inside addons, so remove duplicates
    // by product id (and by exact name when no id is available).
    const seenIds = new Set(main.map((item) => item.product_id).filter(Boolean));
    const seenNames = new Set(main.map((item) => item.name.trim().toLowerCase()));
    const uniqueAddons = addons.filter((item) => {
      const id = item.product_id;
      const name = item.name.trim().toLowerCase();
      if (id && seenIds.has(id)) return false;
      if (!id && seenNames.has(name)) return false;
      if (id) seenIds.add(id);
      seenNames.add(name);
      return true;
    });
    return [...main, ...uniqueAddons];
  }, [product, page?.addons, basePrice, regularPrice, heroImage, delivery]);

  const comboOffers = useMemo<Offer[]>(() => (C.combo_offers ?? []).filter((item) => item.name?.trim() && Number(item.price) > 0).map((item) => ({ name: item.name.trim(), price: Number(item.price), old: item.old_price == null ? null : Number(item.old_price), image: item.image, delivery_fee: item.delivery_fee == null ? delivery : Number(item.delivery_fee), quantity: item.quantity?.trim() || "১ পিস" })), [C.combo_offers, delivery]);

  const current = useMemo(() => {
    if (!selected) return null;
    if (selected.startsWith("combo-")) return comboOffers[Number(selected.slice(6))] ?? null;
    return offers[Number(selected.slice(6))] ?? null;
  }, [selected, offers, comboOffers]);
  const subtotal = current?.price ?? 0;
  const shipping = current?.delivery_fee ?? delivery;
  const total = subtotal + shipping;
  const brand = settings.site_name || "Sheikh Seeds";
  const brandBn = "শেখ সিডস";
  const logo = settings.logo_url || brandLogoFile;
  const features = page?.features?.length ? page.features : DEFAULT_FEATURES;
  const why = page?.why_choose_us?.length ? page.why_choose_us : DEFAULT_WHY;
  const detailRows = (page?.description ?? "").split(/\r?\n+/).map(line => line.replace(/^[•\-*\s]+/, "").trim()).filter(Boolean);
  const savings = regularPrice && regularPrice > basePrice ? regularPrice - basePrice : 0;
  const discount = savings && regularPrice ? Math.round((savings / regularPrice) * 100) : 0;

  useCheckoutAutofill({ form, setForm: updater => setForm(value => updater(value) as typeof value), items: current ? [{ id: current.product_id || `offer-${selected}`, name: current.name, price: current.price, quantity: 1 }] : [], subtotal, total, deliveryFee: shipping });
  useEffect(() => {
    if (!selected) return;
    if (selected.startsWith("combo-")) {
      const index = Number(selected.slice(6));
      if (!comboOffers[index]) setSelected(null);
      return;
    }
    const index = Number(selected.slice(6));
    if (!offers[index]) setSelected(null);
  }, [offers.length, comboOffers.length, selected]);
  useEffect(() => {
    const el = document.getElementById("all-product-order");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => setFormInView(entries.some((e) => e.isIntersecting)), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page]);

  const handleCta = () => {
    if (!offers.length && !comboOffers.length) return;
    if (!selected) {
      setOfferPopupOpen(true);
      return;
    }
    goOrder();
  };

  const openOfferPopup = () => {
    if (!offers.length && !comboOffers.length) return;
    setOfferPopupOpen(true);
  };

  const selectOfferFromPopup = (value: string) => {
    setSelected(value);
    setOfferPopupOpen(false);
    window.setTimeout(() => goOrder(), 80);
  };

  const goOrder = () => {
    const target = document.getElementById("all-product-order-form") ?? document.getElementById("all-product-order");
    if (!target) return;
    const header = document.querySelector('[role="banner"]') as HTMLElement | null;
    const headerHeight = header?.getBoundingClientRect().height ?? 0;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerHeight - 12);
    window.scrollTo({ top, behavior: "smooth" });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.address) return toast.error("নাম ও ঠিকানা পূরণ করুন");
    if (!isValidBdPhone(form.phone)) return toast.error(phoneSubmitError(form.phone));
    if (!current) return toast.error("একটি অফার নির্বাচন করুন");
    setSubmitting(true);
    try {
      const items = [{ id: current.product_id || `offer-${selected}`, name: current.name, price: current.price, quantity: 1 }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: { customer_name: form.name, customer_phone: form.phone.replace(/[\s-]/g, ""), customer_address: form.address, delivery_fee: shipping, items, notes: null, ...getFbContext() } });
      trackPurchase(items, total, order.id);
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (error) { notifyOrderError(error); setSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-all-product-surface" aria-hidden="true" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-all-product-surface text-all-product-ink">পেজ পাওয়া যায়নি</div>;

  return <div className="all-product-landing min-h-screen bg-all-product-surface text-all-product-ink">
    <FacebookPixel eager />
    <GuaranteePopup slug={slug} logo={logo} brand={brand} />
    {page.top_bar_text && <div className="bg-all-product-alert px-3 py-0.5 text-center text-[10px] font-bold leading-4 text-all-product-alert-foreground sm:text-[11px]">{page.top_bar_text}</div>}
    <div role="banner" className="sticky top-0 z-40 bg-all-product-surface/92 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-all-product-gold/70 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div className="relative mx-auto flex h-[40px] max-w-6xl items-center justify-between gap-1.5 px-3 sm:h-[46px] sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><img src={logo} alt={brand} className="h-6 w-6 rounded-full object-cover ring-1 ring-all-product-gold/50 sm:h-7 sm:w-7" /><div className="min-w-0 pt-0.5"><span style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif" }} className="block whitespace-nowrap text-[18px] font-black leading-[1.3] tracking-[0.01em] text-all-product-primary sm:text-[21px]">{brandBn}</span><svg viewBox="0 0 72 8" className="mt-0 block h-1.5 w-[56px] drop-shadow-[0_0_3px_var(--all-product-gold)] sm:w-[70px]" aria-hidden="true"><defs><linearGradient id="ap-gold-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--all-product-gold, #d9a53a)" stopOpacity="0.25" /><stop offset="50%" stopColor="var(--all-product-gold, #d9a53a)" /><stop offset="100%" stopColor="var(--all-product-gold, #d9a53a)" stopOpacity="0.25" /></linearGradient></defs><path d="M2 6.5 Q36 0.5 70 6.5" fill="none" stroke="url(#ap-gold-arc)" strokeWidth="2" strokeLinecap="round" /></svg></div></div>
        <OfferCountdown />
      </div>
    </div>

    {offerPopupOpen && (
      <OfferSelectionPopup
        offers={offers}
        comboOffers={comboOffers}
        selected={selected}
        onSelect={selectOfferFromPopup}
        onClose={() => setOfferPopupOpen(false)}
      />
    )}

    <main>
      <section className="relative overflow-hidden bg-all-product-hero text-all-product-hero-foreground">
        <div className="all-product-grain absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 pb-9 pt-5 sm:pb-11 sm:pt-7">
          <div className="text-center">
            <h1 style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif" }} className="all-product-hero-title mx-auto max-w-3xl text-3xl font-black leading-[1.2] tracking-[-0.01em] sm:text-4xl md:text-5xl">{page.hero_title || page.title}</h1>
            {page.hero_subtitle && <p className="all-product-hero-subtitle mx-auto mt-2.5 max-w-2xl text-sm font-medium leading-6 text-all-product-hero-muted sm:mt-3 sm:text-base">{page.hero_subtitle}</p>}
          </div>

          <div className="mt-5 sm:mt-6">
            <div className="all-product-image-wrap mx-auto max-w-xl overflow-hidden rounded-2xl border-2 border-all-product-gold/45 bg-all-product-surface shadow-2xl">
              <div className="relative">
                <img src={toImg(heroImage, { w: 1100, q: 88 })} onError={event => imgFallback(event, heroImage)} alt={page.hero_title || page.title} width={760} height={760} fetchPriority="high" className="aspect-square w-full object-cover" />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-all-product-surface/95 px-3 py-2 text-xs font-black text-all-product-primary shadow-lg"><Leaf className="h-4 w-4" /> ১০০% অরিজিনাল</span>
              </div>
              <div className="border-t-2 border-all-product-gold/35 bg-gradient-to-r from-all-product-primary/10 via-all-product-gold/15 to-all-product-primary/10 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[11px] font-black tracking-wide text-all-product-primary">আজকের অফার মূল্য</span>
                    <div className="mt-0.5 flex items-end gap-2.5">
                      <span className="text-4xl font-black leading-none tracking-tight text-all-product-primary sm:text-5xl">{taka(basePrice)}</span>
                      {regularPrice && regularPrice > basePrice && <del className="pb-0.5 text-sm font-bold text-all-product-muted sm:text-base">{taka(regularPrice)}</del>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {discount > 0 && <span className="inline-flex rounded-full bg-all-product-alert px-3 py-1.5 text-xs font-black text-white shadow-md">{discount}% ছাড়</span>}
                    {savings > 0 && <span className="mt-1 block text-[11px] font-black text-all-product-success">সাশ্রয় {taka(savings)}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
            <div className="px-2.5 py-3 text-center"><ShieldCheck className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">পরীক্ষিত বীজ</span></div>
            <div className="border-x border-white/10 px-2.5 py-3 text-center"><Truck className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">সারা দেশে ডেলিভারি</span></div>
            <div className="px-2.5 py-3 text-center"><Wallet className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">ক্যাশ অন ডেলিভারি</span></div>
          </div>

          <div className="mx-auto mt-4 max-w-xl text-center">
            <Button size="lg" onClick={handleCta} className="all-product-primary-cta h-13 w-full text-base font-black shadow-xl sm:h-14"><ShoppingBag className="h-5 w-5" />{page.cta_text || "এখনই অর্ডার করুন"}<span aria-hidden="true">→</span></Button>
            <p className="mt-2 text-[11px] font-bold text-all-product-hero-muted">ক্যাশ অন ডেলিভারি • সারা দেশে হোম ডেলিভারি</p>
          </div>
        </div>
        <ChevronDown className="absolute bottom-2 left-1/2 h-5 w-5 -translate-x-1/2 animate-bounce text-all-product-gold" />
      </section>

      {(detailRows.length > 0 || C.gallery_images.length > 0) && <section className="bg-all-product-muted-surface py-7"><div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-lg border border-all-product-line bg-all-product-surface shadow-all-product">
          <div className="flex items-center justify-center gap-2 border-b border-all-product-line bg-all-product-soft px-3.5 py-2 text-center"><Leaf className="h-4 w-4 shrink-0 text-all-product-primary" /><h2 className="text-[13.5px] font-black leading-5">প্রোডাক্ট বিস্তারিত</h2></div>
          {detailRows.length > 0 && <table className="w-full border-collapse text-left"><tbody>{detailRows.map((row, index) => { const [head, ...rest] = row.split(":"); const value = rest.join(":").trim(); return <tr key={index} className="border-b border-all-product-line/70 last:border-0"><td className="px-4 py-2.5 text-[12.5px] leading-6"><span className="mr-1.5 font-black text-all-product-primary">•</span><span className="font-black">{value ? head.trim() : row}</span>{value && <span className="text-all-product-muted"> — {value}</span>}</td></tr>; })}</tbody></table>}
          {C.gallery_images.length > 0 && <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3">{C.gallery_images.slice(0,3).map((image, index) => <img key={image + index} src={toImg(image, { w: 600, q: 82 })} alt={`${page.title} বিস্তারিত ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-md border border-all-product-line object-cover" />)}</div>}
        </div>
      </div></section>}

      <section className="bg-all-product-surface py-7"><div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-xl border border-all-product-line bg-all-product-surface shadow-all-product">
          <div className="flex items-center justify-center gap-2 border-b border-all-product-line bg-all-product-soft px-4 py-2.5 text-center"><Sparkles className="h-4 w-4 shrink-0 text-all-product-primary" /><h2 className="text-[13.5px] font-black leading-5">প্রোডাক্ট বৈশিষ্ট্য</h2></div>
          <table className="w-full border-collapse text-left"><tbody>{features.slice(0,6).map((feature, index) => <tr key={index} className="border-b border-all-product-line/50 last:border-0"><td className="px-4 py-3 text-[13.5px] leading-6"><span className="mr-2">{feature.icon || ["🌱","✓","🚚","🛡️","💧","☀️"][index]}</span><span className="font-black">{feature.title}</span>{feature.text && <span className="text-all-product-muted"> — {feature.text}</span>}</td></tr>)}</tbody></table>
        </div>
      </div></section>

      <div className="bg-all-product-surface px-4 pb-2 text-center">
        <div className="mx-auto max-w-md"><Button size="lg" onClick={handleCta} className="all-product-primary-cta h-12 w-full text-base font-black"><ShoppingBag className="h-5 w-5" />{page.cta_text || "এখনই অর্ডার করুন"}<span aria-hidden="true">→</span></Button><p className="mt-2 text-[11px] font-bold text-all-product-muted">ক্যাশ অন ডেলিভারি • সারা দেশে হোম ডেলিভারি</p></div>
      </div>

      <section className="bg-all-product-muted-surface py-7"><div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-xl border border-all-product-line/70 bg-all-product-surface shadow-all-product">
          <div className="flex items-center justify-center gap-2 border-b border-all-product-line/70 bg-all-product-soft px-4 py-2.5 text-center"><ShieldCheck className="h-4 w-4 shrink-0 text-all-product-primary" /><h2 className="text-[13.5px] font-black leading-5">আমাদের থেকে কেন নিবেন</h2></div>
          <table className="w-full border-collapse text-left"><tbody>{why.slice(0,6).map((item, index) => <tr key={index} className="border-b border-all-product-line/40 last:border-0 transition-colors hover:bg-all-product-soft/40"><td className="px-4 py-3.5 text-[13.5px] leading-6"><span className="mr-2">{item.icon || ["💵","🚚","🛡️","☎️","🌱","⭐"][index]}</span><span className="font-black">{item.title}</span>{item.text && <span className="text-all-product-muted"> — {item.text}</span>}</td></tr>)}</tbody></table>
        </div>
      </div></section>

      <section id="all-product-order" className="scroll-mt-20 bg-all-product-checkout py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-all-product-primary px-3 py-1.5 text-xs font-black text-all-product-primary-foreground"><PackageCheck className="h-4 w-4" /> মাত্র ৩০ সেকেন্ডে অর্ডার</span>
            <h2 className="mt-3 whitespace-nowrap text-[22px] font-black leading-tight sm:text-3xl">নিচের ফর্ম গুলো পূরন করুন</h2>
            <p className="mt-1 text-sm text-all-product-muted">২-৩ দিনের মধ্যে হোম ডেলিভারি পেয়ে যাবেন</p>
          </div>

          <form id="all-product-order-form" onSubmit={submit} className="overflow-hidden rounded-lg border border-all-product-line bg-all-product-surface shadow-all-product">
            <div className="border-b border-all-product-line p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span>
                <h3 className="font-black">আপনার তথ্য দিন</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <CheckoutField label="আপনার নাম" icon={<User />}><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="আপনার পুরো নাম" /></CheckoutField>
                <CheckoutField label="মোবাইল নম্বর" icon={<Phone />}><input required type="tel" inputMode="numeric" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/[^\d]/g, "").slice(0, 16) })} placeholder="01XXXXXXXXX" /></CheckoutField>
                <div className="sm:col-span-2">
                  <CheckoutField label="সম্পূর্ণ ঠিকানা" icon={<MapPin />}><textarea required rows={2} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="গ্রাম/এলাকা, থানা, জেলা" /></CheckoutField>
                </div>
              </div>
            </div>

            <div className="border-b border-all-product-line p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">২</span>
                <div>
                  <h3 className="font-black">অফার সিলেক্ট করুন</h3>
                  <p className="text-[10px] font-semibold text-all-product-muted">আপনার পছন্দের অফারটি বেছে নিন</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {offers.map((offer, index) => {
                  const active = selected === `offer-${index}`;
                  return (
                    <button
                      key={`${offer.name}-${index}`}
                      type="button"
                      onClick={() => setSelected(`offer-${index}`)}
                      aria-pressed={active}
                      className={`group relative flex min-w-0 items-center gap-1.5 rounded-xl border p-1.5 text-left transition-all active:scale-[.99] ${active ? "border-all-product-primary bg-all-product-primary/[0.04] ring-1 ring-all-product-primary/20" : "border-all-product-line bg-all-product-surface hover:border-all-product-primary/40"}`}
                    >
                      {offer.image && <img src={toImg(offer.image, { w: 120, q: 78 })} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/5" />}
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[10px] font-black leading-[1.35] text-all-product-ink">{offer.name}</span>
                        <span className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
                          <span className="text-[13px] font-black leading-none text-all-product-primary">{taka(offer.price)}</span>
                          {offer.old && offer.old > offer.price && <del className="text-[8px] font-semibold text-all-product-muted">{taka(offer.old)}</del>}
                        </span>
                        <span className="mt-0.5 block whitespace-nowrap text-[8px] font-semibold leading-3 text-all-product-muted">{offer.delivery_fee === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</span>
                      </span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? "border-all-product-primary bg-all-product-primary text-all-product-primary-foreground" : "border-all-product-line bg-all-product-soft text-transparent"}`}>
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {comboOffers.length > 0 && (
                <div className="mt-4 border-t border-all-product-line pt-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black">Combo Offer</h4>
                      <p className="mt-0.5 text-[11px] font-semibold text-all-product-muted">আরও সাশ্রয়ী প্যাকেজ থেকে বেছে নিন</p>
                    </div>
                    <span className="rounded-full bg-all-product-gold/15 px-2 py-1 text-[10px] font-black text-all-product-gold-foreground">বিশেষ অফার</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {comboOffers.map((offer, index) => {
                      const active = selected === `combo-${index}`;
                      return (
                        <button
                          key={`combo-${offer.name}-${index}`}
                          type="button"
                          onClick={() => setSelected(`combo-${index}`)}
                          aria-pressed={active}
                          className={`group relative overflow-hidden rounded-xl border bg-all-product-surface p-1.5 text-left transition-all active:scale-[.99] ${active ? "border-all-product-primary ring-1 ring-all-product-primary/25 shadow-[0_8px_24px_-14px_rgba(20,83,45,.55)]" : "border-all-product-line hover:border-all-product-primary/50"}`}
                        >
                          <div className="relative overflow-hidden rounded-lg bg-all-product-soft">
                            <img src={toImg(offer.image || "/placeholder.svg", { w: 420, q: 80 })} alt={offer.name} loading="lazy" className="aspect-square w-full object-cover" />
                            {active && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-all-product-primary text-all-product-primary-foreground shadow"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
                          </div>
                          <div className="px-0.5 pb-1 pt-1.5">
                            <div className="text-[12px] font-black leading-[1.35] text-all-product-ink break-words">{offer.name}</div>
                            <div className="mt-1 flex items-center justify-between gap-1.5">
                              <span className="min-w-0 truncate rounded-full bg-all-product-primary/10 px-1.5 py-0.5 text-[9px] font-black text-all-product-primary">{offer.quantity || "১ পিস"}</span>
                              <span className="shrink-0 text-[16px] font-black leading-none text-all-product-primary">{taka(offer.price)}</span>
                            </div>
                            {offer.old && offer.old > offer.price && <del className="mt-0.5 block text-[9px] text-all-product-muted">{taka(offer.old)}</del>}
                            <div className="mt-0.5 text-[9px] font-bold text-all-product-muted">{offer.delivery_fee === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">৩</span>
                <h3 className="font-black">পেমেন্ট ও অর্ডার</h3>
              </div>
              <div className="mb-4 flex items-center gap-3 rounded-md border border-all-product-primary/30 bg-all-product-soft p-3">
                <Wallet className="h-5 w-5 text-all-product-primary" />
                <div className="flex-1"><div className="text-sm font-black">ক্যাশ অন ডেলিভারি</div><div className="text-xs text-all-product-muted">পণ্য হাতে পেয়ে টাকা দিন</div></div>
                <Check className="h-5 w-5 text-all-product-primary" />
              </div>
              <div className="mb-4 divide-y divide-all-product-line rounded-md border border-all-product-line text-sm">
                <div className="flex justify-between p-3"><span className="text-all-product-muted">পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div>
                <div className="flex justify-between p-3"><span className="text-all-product-muted">ডেলিভারি</span><b>{shipping === 0 ? "ফ্রি" : taka(shipping)}</b></div>
                <div className="flex justify-between bg-all-product-soft p-3 text-base"><span className="font-black">সর্বমোট</span><b className="text-all-product-primary">{taka(total)}</b></div>
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-all-product-muted">কোনো অগ্রিম পেমেন্ট লাগবে না • অর্ডারের পর কল করে নিশ্চিত করা হবে</p>
            </div>
          </form>
        </div>
      </section>

    </main>
    <div role="contentinfo" className="bg-all-product-hero px-4 py-6 text-center text-xs text-all-product-hero-muted">© {new Date().getFullYear()} {brand} — বিশ্বস্ত বীজ, সুন্দর ভবিষ্যৎ</div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-all-product-line bg-all-product-surface/95 p-2 backdrop-blur-lg"><div className="mx-auto max-w-3xl">{formInView ? <Button type="submit" form="all-product-order-form" disabled={submitting} className="all-product-primary-cta h-12 w-full font-black"><ShieldCheck />{submitting ? "অর্ডার হচ্ছে..." : `অর্ডার টি কনফার্ম করুন — ${taka(total)}`}</Button> : <Button onClick={handleCta} className="all-product-primary-cta h-12 w-full font-black"><ShoppingBag />{page.cta_text || "এখনই অর্ডার করুন"}{selected ? ` — ${taka(total)}` : ""}</Button>}</div></div>
  </div>;
}

const AP_COUNTDOWN_STYLE = `
@keyframes apCdTick{from{opacity:.1;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes apCdPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.6}}
.ap-cd-box{animation:apCdTick .32s ease-out}
.ap-cd-dot{animation:apCdPulse 1.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ap-cd-box,.ap-cd-dot{animation:none!important}}
`;

function bnDigits(value: number) { return String(value).padStart(2, "0").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]); }

/** Compact premium countdown to the end of the day, shown in the sticky header. */
function OfferCountdown() {
  const [msLeft, setMsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => { const end = new Date(); end.setHours(24, 0, 0, 0); setMsLeft(Math.max(0, end.getTime() - Date.now())); };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (msLeft === null) return null;
  const total = Math.floor(msLeft / 1000);
  const units = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return (
    <>
      <style>{AP_COUNTDOWN_STYLE}</style>
      <div className="flex shrink-0 items-center gap-1 text-[9px] font-black text-all-product-alert sm:gap-1.5 sm:text-[10px]" aria-label="অফার শেষ হওয়ার কাউন্টডাউন">
        <span className="ap-cd-dot h-1.5 w-1.5 shrink-0 rounded-full bg-all-product-alert" aria-hidden="true" />
        <span className="whitespace-nowrap">অফার শেষ হতে বাকি</span>
        <span className="flex shrink-0 items-center gap-0.5 sm:gap-1">{units.map((unit, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-all-product-muted">:</span>}
            <span key={unit} className="ap-cd-box rounded bg-all-product-alert/10 px-1 py-0.5 tabular-nums ring-1 ring-all-product-alert/25">{bnDigits(unit)}</span>
          </span>
        ))}</span>
      </div>
    </>
  );
}

function CheckoutField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label} <span className="text-all-product-alert">*</span></span><span className="all-product-field relative block"><span className="pointer-events-none absolute left-3 top-3.5 text-all-product-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>{children}</span></label>;
}


function OfferSelectionPopup({
  offers,
  comboOffers,
  selected,
  onSelect,
  onClose,
}: {
  offers: Offer[];
  comboOffers: Offer[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = popupRef.current;
    if (!el || typeof window === "undefined" || el.scrollHeight <= el.clientHeight + 8) return;
    const up = window.setTimeout(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: Math.min(max, 90), behavior: "smooth" });
      const back = window.setTimeout(() => el.scrollTo({ top: 0, behavior: "smooth" }), 500);
      (el as HTMLDivElement & { __apBack?: number }).__apBack = back;
    }, 220);
    return () => {
      window.clearTimeout(up);
      const back = (el as HTMLDivElement & { __apBack?: number }).__apBack;
      if (back) window.clearTimeout(back);
    };
  }, [offers.length, comboOffers.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-2.5 py-2.5 backdrop-blur-[5px] sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="প্রোডাক্ট সিলেক্ট করুন"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={popupRef}
        className="flex max-h-[86vh] w-full max-w-[410px] flex-col overflow-y-auto overscroll-contain rounded-[22px] border border-all-product-line/80 bg-all-product-surface shadow-[0_28px_90px_-30px_rgba(0,0,0,.72)]"
      >
        <div className="sticky top-0 z-20 shrink-0 border-b border-all-product-line bg-all-product-surface px-3.5 py-3 shadow-[0_4px_14px_-12px_rgba(0,0,0,.45)] sm:px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-all-product-primary/10 text-all-product-primary ring-1 ring-all-product-primary/15">
              <ShoppingBag className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-black leading-5 text-all-product-ink">প্রোডাক্ট সিলেক্ট করুন</h3>
              <p className="mt-0.5 text-[10px] font-semibold leading-4 text-all-product-muted">পছন্দের প্রোডাক্ট বা কম্বো অফারটি বেছে নিন</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-all-product-soft text-all-product-ink ring-1 ring-all-product-line transition hover:bg-all-product-primary/10 hover:text-all-product-primary"
              aria-label="বন্ধ করুন"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-3.5">
          {offers.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wide text-all-product-primary">মেইন প্রডাক্ট</h4>
                  <p className="mt-0.5 text-[9px] font-semibold text-all-product-muted">একটি পছন্দ করে এগিয়ে যান</p>
                </div>
                <span className="rounded-full bg-all-product-primary/10 px-2 py-1 text-[8px] font-black text-all-product-primary">
                  {offers.length} টি
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {offers.map((offer, index) => {
                  const value = `offer-${index}`;
                  const active = selected === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onSelect(value)}
                      aria-pressed={active}
                      className={`group flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition-all active:scale-[.99] ${
                        active
                          ? "border-all-product-primary bg-all-product-primary/5 ring-2 ring-all-product-primary/10 shadow-sm"
                          : "border-all-product-line bg-all-product-surface hover:border-all-product-primary/45 hover:shadow-sm"
                      }`}
                    >
                      {offer.image && (
                        <img
                          src={toImg(offer.image, { w: 96, q: 78 })}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[9.5px] font-black leading-[1.25] text-all-product-ink">{offer.name}</span>
                        <span className="mt-1 block text-[10px] font-black text-all-product-primary">{taka(offer.price)}</span>
                      </span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                        active ? "border-all-product-primary bg-all-product-primary text-all-product-primary-foreground" : "border-all-product-line bg-all-product-soft"
                      }`}>
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {comboOffers.length > 0 && (
            <section className="mt-3 border-t border-all-product-line pt-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wide text-all-product-primary">Combo Offer</h4>
                  <p className="mt-0.5 text-[9px] font-semibold text-all-product-muted">আরও সাশ্রয়ী প্যাকেজ</p>
                </div>
                <span className="rounded-full bg-all-product-primary/10 px-2 py-1 text-[8px] font-black text-all-product-primary">{comboOffers.length} টি</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {comboOffers.map((offer, index) => {
                  const value = `combo-${index}`;
                  const active = selected === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onSelect(value)}
                      aria-pressed={active}
                      className={`group relative overflow-hidden rounded-xl border bg-all-product-surface p-1.5 text-left transition-all active:scale-[.99] ${
                        active
                          ? "border-all-product-primary ring-2 ring-all-product-primary/15 shadow-md"
                          : "border-all-product-line hover:border-all-product-primary/45 hover:shadow-sm"
                      }`}
                    >
                      <div className="relative overflow-hidden rounded-lg bg-all-product-soft">
                        <img
                          src={toImg(offer.image || "/placeholder.svg", { w: 420, q: 80 })}
                          alt={offer.name}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                        {active && (
                          <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-all-product-primary text-all-product-primary-foreground shadow">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </div>
                      <div className="px-0.5 pb-1 pt-1.5">
                        <div className="break-words text-[10px] font-black leading-[1.3] text-all-product-ink">{offer.name}</div>
                        <div className="mt-1 flex items-center justify-between gap-1.5">
                          <span className="min-w-0 truncate rounded-full bg-all-product-primary/10 px-1.5 py-0.5 text-[8px] font-black text-all-product-primary">{offer.quantity || "১ পিস"}</span>
                          <span className="shrink-0 text-[13px] font-black leading-none text-all-product-primary">{taka(offer.price)}</span>
                        </div>
                        <div className="mt-1 text-[8px] font-bold text-all-product-muted">{offer.delivery_fee === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}