import { SafeImage } from "@/components/SafeImage";
import { LANDING_PAGES_COLUMNS } from "@/lib/read-columns";
import { useEffect, useMemo, useState, useRef, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBag, Sparkles, Truck, User, Volume2, VolumeX, Wallet, X } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { createLandingCheckoutIntent, finalizeLandingCheckoutIntent, placeOrder } from "@/lib/place-order.functions";
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
import { NutrimixReviews } from "@/components/landing/NutrimixReviews";
import { SeedComboNutrimixPopup } from "@/components/landing/CleanLandingPage";

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; badge?: string; delivery_fee?: number | null };
type Page = { id: string; slug: string; title: string; reviews?: { name: string; rating: number; text: string; image?: string }[] | null; show_reviews?: boolean; top_bar_text?: string | null; hero_title?: string | null; hero_subtitle?: string | null; hero_image?: string | null; cta_text?: string | null; regular_price?: number | null; sale_price?: number | null; main_delivery_fee?: number | null; features?: Feature[] | null; why_choose_us?: WhyItem[] | null; addons?: Addon[] | null; theme_color?: string | null; planting_steps?: unknown; description?: string | null; is_published?: boolean; products?: Product | null };
type Offer = { name: string; price: number; old?: number | null; image?: string; product_id?: string; delivery_fee: number; badge?: string; quantity?: string };

export function AllProductLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const runCreateLandingIntent = useServerFn(createLandingCheckoutIntent);
  const runFinalizeLandingIntent = useServerFn(finalizeLandingCheckoutIntent);
  const isNutrimix = slug === "nutrimix";
  const isSeedCombo = slug === "seedcombo";
  const isAudioLanding = isNutrimix || isSeedCombo;
  const [selected, setSelected] = useState<string | null>(null);
  const [offerPopupOpen, setOfferPopupOpen] = useState(false);
  const [nutrimixOpen, setNutrimixOpen] = useState(false);
  const [nutrimix, setNutrimix] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const orderInFlightRef = useRef(false);
  const orderCreatedRef = useRef(false);
  const landingIntentIdRef = useRef<string | null>(null);
  const landingCheckoutSessionRef = useRef<string | null>(null);
  const landingInitiateCheckoutRef = useRef(false);
  const [formInView, setFormInView] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  // The route loader already fetched this row fresh on the server for this very
  // request, so hydration must not spend the visitor's bandwidth re-fetching it.
  const { data: page, isLoading } = useQuery({ queryKey: ["landing-all-product", slug], staleTime: 5 * 60_000, refetchOnWindowFocus: false, queryFn: async () => (await supabase.from("landing_pages").select(`${LANDING_PAGES_COLUMNS}, products(id,name,price,sale_price,images)`).eq("slug", slug).eq("is_published", true).maybeSingle()).data as Page | null });
  const { data: settingsRow } = useQuery({ queryKey: ["site-settings-public"], staleTime: 300_000, queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data });
  const settings = (settingsRow?.settings as { site_name?: string; tagline?: string; logo_url?: string }) ?? {};
  const product = page?.products ?? null;
  const C = mergeContent(page?.planting_steps);
  const heroImage = page?.hero_image || product?.images?.[0] || "/placeholder.svg";
  const configuredHeroImages = Array.isArray(C.hero_gallery_images) ? C.hero_gallery_images.filter(Boolean) : [];
  const heroImages = isNutrimix ? Array.from(new Set([heroImage, ...configuredHeroImages])) : [heroImage];
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { setHeroImageIndex(0); }, [page?.id, heroImages.length]);
  useEffect(() => {
    if (!isAudioLanding || !C.audio_url) { setAudioPlaying(false); return; }
    let timer: number | undefined;
    const start = () => {
      const audio = audioRef.current;
      if (!audio) {
        timer = window.setTimeout(start, 100);
        return;
      }
      audio.pause();
      audio.currentTime = 0;
      audio.load();
      timer = window.setTimeout(() => {
        audio.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
      }, 2000);
    };
    start();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      audioRef.current?.pause();
    };
  }, [isAudioLanding, C.audio_url]);
  const toggleLandingAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !C.audio_url) return;
    if (!audio.paused) { audio.pause(); setAudioPlaying(false); return; }
    try { await audio.play(); setAudioPlaying(true); } catch { setAudioPlaying(false); }
  };
  useEffect(() => {
    if (!isNutrimix || heroImages.length < 2) return;
    const timer = window.setInterval(() => setHeroImageIndex((current) => (current + 1) % heroImages.length), 5000);
    return () => window.clearInterval(timer);
  }, [isNutrimix, heroImages.length]);
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

  const comboOffers = useMemo<Offer[]>(() => (C.combo_offers ?? []).filter((item) => item.is_active !== false && item.name?.trim() && Number(item.price) > 0).map((item) => ({ name: item.name.trim(), price: Number(item.price), old: item.old_price == null ? null : Number(item.old_price), image: item.image, delivery_fee: item.delivery_fee == null ? delivery : Number(item.delivery_fee), quantity: item.quantity?.trim() || "১ পিস" })), [C.combo_offers, delivery]);

  useEffect(() => {
    if (!isNutrimix || selected || isLoading) return;
    if (offers.length > 0) setSelected("offer-0");
    else if (comboOffers.length > 0) setSelected("combo-0");
  }, [isNutrimix, isLoading, offers.length, comboOffers.length, selected]);

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
    if (isNutrimix) {
      if (!selected) setSelected(offers.length ? "offer-0" : "combo-0");
      goOrder();
      return;
    }
    if (C.product_selection_popup_enabled !== false && !selected) {
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
  const openNutrimix = async () => {
    if (C.nutrimix_popup_enabled === false || submitting || !current) return;
    // Legacy All Product offers may not have a database product_id.
    // The order RPC already supports such items with a null product_id,
    // so do not block checkout just because this optional field is missing.
    const seedProductId = current.product_id || `landing-offer:${page.id}:${selected || "unknown"}`;
    if (!form.name || !form.address) {
      toast.error("নাম ও ঠিকানা পূরণ করুন");
      return;
    }
    if (!isValidBdPhone(form.phone)) {
      toast.error(phoneSubmitError(form.phone));
      return;
    }
    const p = {
      id: "landing-popup-nutrimix",
      name: C.nutrimix_offer_name || "NUTRIMIX - গাছের খাদ্য",
      price: Number(C.nutrimix_offer_price) || 0,
      sale_price: Number(C.nutrimix_offer_price) || 0,
      old_price: Number(C.nutrimix_offer_old_price) || 0,
      images: C.nutrimix_offer_image ? [C.nutrimix_offer_image] : [],
    };
    if (p.price <= 0) {
      toast.error("Popup Product-এর নাম ও দাম সেট করুন");
      return;
    }
    try {
      if (!landingCheckoutSessionRef.current) landingCheckoutSessionRef.current = crypto.randomUUID();
      const seedItem = { id: seedProductId, name: current.name, price: current.price, quantity: 1 };
      const nutrimixItem = { id: p.id, name: p.name, price: p.price, quantity: 1 };
      if (!landingInitiateCheckoutRef.current) {
        landingInitiateCheckoutRef.current = true;
        trackInitiateCheckout([seedItem], total);
      }
      const intent = await runCreateLandingIntent({
        data: {
          checkout_session_id: landingCheckoutSessionRef.current,
          customer_name: form.name,
          customer_phone: form.phone.replace(/[\s-]/g, ""),
          customer_address: form.address,
          delivery_fee: shipping,
          seed_items: [seedItem],
          nutrimix_item: nutrimixItem,
          notes: null,
        },
      });
      landingIntentIdRef.current = intent.id;

      // Keep the durable checkout intent pending while the NUTRIMIX offer is shown.
      // Final order creation happens after the customer's choice, so any repeat-order
      // block is surfaced after the NUTRIMIX popup rather than before it.
      setNutrimix(p);
      setNutrimixOpen(true);
      landingIntentIdRef.current = intent.id;
    } catch (error) {
      landingInitiateCheckoutRef.current = false;
      notifyOrderError(error);
    }
  };

  const placeWithNutrimix = async (include: boolean) => {
    setNutrimixOpen(false);
    if (orderInFlightRef.current) return;
    if (!landingIntentIdRef.current) return;
    orderInFlightRef.current = true;
    setSubmitting(true);
    try {
      const order = await runFinalizeLandingIntent({
        data: {
          intent_id: landingIntentIdRef.current,
          include_nutrimix: Boolean(include),
          emit_purchase: true,
          ...getFbContext(),
        },
      });
      const purchaseItems = [{ id: current.product_id || `landing-offer:${page.id}:${selected || "unknown"}`, name: current.name, price: current.price, quantity: 1 }, ...(include && nutrimix ? [{ id: nutrimix.id, name: nutrimix.name, price: Number(nutrimix.sale_price ?? nutrimix.price), quantity: 1 }] : [])];
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.price * item.quantity, 0) + shipping;
      trackPurchase(purchaseItems, purchaseTotal, order.id);
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (error) {
      orderInFlightRef.current = false;
      notifyOrderError(error);
      setSubmitting(false);
    }
  };

  const submit = async (event: React.FormEvent, skipNutrimixPopup = false) => {
    event.preventDefault();
    if (orderCreatedRef.current || orderInFlightRef.current) return;
    if (!form.name || !form.address) return toast.error("নাম ও ঠিকানা পূরণ করুন");
    if (!isValidBdPhone(form.phone)) return toast.error(phoneSubmitError(form.phone));
    if (!current) return toast.error("একটি অফার নির্বাচন করুন");
    if (!isNutrimix && !skipNutrimixPopup && C.nutrimix_popup_enabled !== false) {
      await openNutrimix();
      return;
    }
    orderInFlightRef.current = true;
    setSubmitting(true);
    try {
      const items = [{ id: current.product_id || `offer-${selected}`, name: current.name, price: current.price, quantity: 1 }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: { customer_name: form.name, customer_phone: form.phone.replace(/[\s-]/g, ""), customer_address: form.address, delivery_fee: shipping, items, notes: null, ...getFbContext() } });
      orderCreatedRef.current = true;
      trackPurchase(items, total, order.id);
      toast.success("অর্ডার সফল হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (error) { orderInFlightRef.current = false; notifyOrderError(error); setSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-all-product-surface" aria-hidden="true" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-all-product-surface text-all-product-ink">পেজ পাওয়া যায়নি</div>;

  return <div className="all-product-landing min-h-screen bg-all-product-surface text-all-product-ink">
    <FacebookPixel eager />
    {isAudioLanding && C.audio_url && <audio ref={audioRef} src={C.audio_url} preload="auto" onPlay={() => setAudioPlaying(true)} onPause={() => setAudioPlaying(false)} onEnded={() => setAudioPlaying(false)} className="hidden" />}

    <GuaranteePopup slug={slug} logo={logo} brand={brand} nutrimix={isNutrimix} />
    {page.top_bar_text && <div className="bg-all-product-alert px-3 py-0.5 text-center text-[10px] font-bold leading-4 text-all-product-alert-foreground sm:text-[11px]">{page.top_bar_text}</div>}
    <div role="banner" className="sticky top-0 z-40 bg-all-product-surface/92 shadow-[0_2px_14px_-6px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-all-product-gold/70 to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div className="relative mx-auto flex h-[40px] max-w-6xl items-center justify-between gap-1.5 px-3 sm:h-[46px] sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2"><SafeImage src={logo} alt={brand} className="h-6 w-6 rounded-full object-cover ring-1 ring-all-product-gold/50 sm:h-7 sm:w-7" /><div className="min-w-0 pt-0.5"><span style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif" }} className="block whitespace-nowrap text-[18px] font-black leading-[1.3] tracking-[0.01em] text-all-product-primary sm:text-[21px]">{brandBn}</span><svg viewBox="0 0 72 8" className="mt-0 block h-1.5 w-[56px] drop-shadow-[0_0_3px_var(--all-product-gold)] sm:w-[70px]" aria-hidden="true"><defs><linearGradient id="ap-gold-arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--all-product-gold, #d9a53a)" stopOpacity="0.25" /><stop offset="50%" stopColor="var(--all-product-gold, #d9a53a)" /><stop offset="100%" stopColor="var(--all-product-gold, #d9a53a)" stopOpacity="0.25" /></linearGradient></defs><path d="M2 6.5 Q36 0.5 70 6.5" fill="none" stroke="url(#ap-gold-arc)" strokeWidth="2" strokeLinecap="round" /></svg></div></div>
        <OfferCountdown />
      </div>
    </div>

    {!isNutrimix && nutrimixOpen && nutrimix && (
      <SeedComboNutrimixPopup
        product={nutrimix}
        seedName={current?.name || page.title}
        seedPrice={Number(current?.price || 0)}
        seedDeliveryFee={Number(current?.delivery_fee ?? delivery)}
        onChoice={placeWithNutrimix}
        onClose={() => placeWithNutrimix(false)}
        popupHeading={C.nutrimix_popup_heading}
        popupDescription={C.nutrimix_popup_description}
        popupAcceptText={C.nutrimix_popup_accept_text}
        popupDeclineText={C.nutrimix_popup_decline_text}
        popupAudioUrl={C.nutrimix_popup_audio_url || ""}
      />
    )}

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
      <section className="relative overflow-hidden bg-all-product-hero/90 text-all-product-hero-foreground">
        <div className="all-product-grain absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 pb-4 pt-3 sm:pb-6 sm:pt-4">
          <div className="text-center">
            {isNutrimix ? (
              <div className="mx-auto max-w-2xl px-1 sm:px-0">
                <div className="nutrimix-hero-headline relative overflow-hidden rounded-[22px] border border-all-product-gold/25 bg-gradient-to-br from-white/[0.10] via-all-product-primary/[0.12] to-all-product-gold/[0.10] px-4 py-3 shadow-[0_18px_50px_-28px_rgba(0,0,0,.7)] backdrop-blur-sm sm:rounded-[26px] sm:px-7 sm:py-4">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-all-product-gold/15 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-all-product-primary/20 blur-2xl" />
                  <div className="nutrimix-headline-shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="relative">
                    <h1 style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif", textShadow: "0 2px 18px rgba(0,0,0,.28)" }} className="mx-auto max-w-2xl text-[26px] font-black leading-[1.28] tracking-[-0.02em] text-all-product-hero-foreground sm:text-4xl md:text-5xl">{(page.hero_title || page.title).split(/(নিউট্রিমিক্স|NUTRIMIX)/gi).map((part, index) => /^(নিউট্রিমিক্স|NUTRIMIX)$/i.test(part) ? <span key={index} className="text-all-product-gold">{part}</span> : <span key={index}>{part}</span>)}</h1>
                    <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-gradient-to-r from-all-product-gold/30 via-all-product-gold to-all-product-gold/30 sm:mt-2.5 sm:w-20" aria-hidden="true" />
                  </div>
                </div>
                <style>{`
                  @keyframes nutrimixHeadlineFloat {
                    0%, 100% { transform: translateY(0); box-shadow: 0 18px 50px -28px rgba(0,0,0,.7), 0 0 0 0 rgba(217,165,58,.20); }
                    50% { transform: translateY(-2px); box-shadow: 0 20px 52px -28px rgba(0,0,0,.68), 0 0 0 5px rgba(217,165,58,0); }
                  }
                  @keyframes nutrimixHeadlineShine {
                    0%, 55% { transform: translateX(0); opacity: 0; }
                    65% { opacity: 1; }
                    85%, 100% { transform: translateX(430%); opacity: 0; }
                  }
                  .nutrimix-hero-headline { animation: nutrimixHeadlineFloat 3.2s ease-in-out infinite; }
                  .nutrimix-headline-shine { animation: nutrimixHeadlineShine 4.8s ease-in-out infinite; }
                  @media (prefers-reduced-motion: reduce) {
                    .nutrimix-hero-headline, .nutrimix-headline-shine { animation: none !important; }
                  }
                `}</style>
              </div>
            ) : (
              <h1 style={{ fontFamily: "'Noto Serif Bengali', 'Hind Siliguri', serif" }} className="all-product-hero-title mx-auto max-w-3xl text-3xl font-black leading-[1.2] tracking-[-0.01em] sm:text-4xl md:text-5xl">{page.hero_title || page.title}</h1>
            )}
            {isNutrimix && (
              <>
                <div className="nutrimix-free-seed-line mx-auto mt-2.5 inline-flex items-center justify-center whitespace-nowrap rounded-full border border-all-product-gold/45 bg-all-product-primary/20 px-4 py-1.5 text-[15px] font-black leading-none text-all-product-hero-foreground shadow-[0_10px_28px_-16px_rgba(0,0,0,.65)] backdrop-blur-sm sm:mt-3 sm:px-6 sm:py-2 sm:text-lg" aria-label="২৪ প্রকারের বীজ ও ডেলিভারি চার্জ ফ্রী">
                  <span className="text-all-product-gold">২৪ প্রকারের বীজ</span>
                  <span className="mx-1.5 text-all-product-gold/70">+</span>
                  <span>ডেলিভারি চার্জ</span>
                  <span className="ml-1.5 text-all-product-gold">ফ্রী</span>
                </div>
                <style>{`
                  @keyframes nutrimixFreeSeedPulse {
                    0%, 100% { transform: scale(1); filter: brightness(1); box-shadow: 0 10px 28px -16px rgba(0,0,0,.65), 0 0 0 0 rgba(217,165,58,.28); }
                    50% { transform: scale(1.018); filter: brightness(1.08); box-shadow: 0 12px 32px -16px rgba(0,0,0,.62), 0 0 0 7px rgba(217,165,58,0); }
                  }
                  .nutrimix-free-seed-line { animation: nutrimixFreeSeedPulse 2.2s ease-in-out infinite; }
                  @media (prefers-reduced-motion: reduce) {
                    .nutrimix-free-seed-line { animation: none !important; }
                  }
                `}</style>
              </>
            )}
            {page.hero_subtitle && <p className="all-product-hero-subtitle mx-auto mt-2 max-w-2xl text-sm font-medium leading-6 text-all-product-hero-muted sm:mt-2.5 sm:text-base">{page.hero_subtitle}</p>}
          </div>

          <div className="mt-4 sm:mt-5">
            <div className="all-product-image-wrap mx-auto max-w-xl overflow-hidden rounded-2xl border-2 border-all-product-gold/45 bg-all-product-surface shadow-2xl">
              <div className="relative aspect-square overflow-hidden">
                {heroImages.map((image, index) => (
                  <SafeImage key={image + index} src={toImg(image, { w: 1100, q: 88 })}  alt={page.hero_title || page.title} width={760} height={760} fetchPriority={index === 0 ? "high" : "auto"} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out ${index === heroImageIndex ? "opacity-100" : "opacity-0"}`} />
                ))}
                {!isNutrimix && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-all-product-surface/95 px-3 py-2 text-xs font-black text-all-product-primary shadow-lg"><Leaf className="h-4 w-4" /> ১০০% অরিজিনাল</span>}
                {isNutrimix && heroImages.length > 1 && <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur-md">{heroImages.map((_, index) => <button key={index} type="button" onClick={() => setHeroImageIndex(index)} aria-label={`ইমেজ ${index + 1}`} className={`h-1.5 rounded-full transition-all duration-500 ${index === heroImageIndex ? "w-7 bg-white" : "w-1.5 bg-white/55"}`} />)}</div>}
              </div>           <div className="border-t-2 border-all-product-gold/35 bg-gradient-to-r from-all-product-primary/10 via-all-product-gold/15 to-all-product-primary/10 px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <span className="block text-[11px] font-black tracking-wide text-all-product-primary">আজকের অফার মূল্য</span>
                    <div className="mt-0.5 flex items-end gap-2.5">
                      <span className="text-4xl font-black leading-none tracking-tight text-all-product-primary sm:text-5xl">{taka(basePrice)}</span>
                      {regularPrice && regularPrice > basePrice && <del className="pb-0.5 text-sm font-bold text-all-product-muted sm:text-base">{taka(regularPrice)}</del>}
                    </div>
                  </div>
                  {isNutrimix && C.audio_url && (
                    <>

                      <button type="button" onClick={toggleLandingAudio} aria-label={audioPlaying ? "ভয়েস বন্ধ করুন" : "ভয়েস চালু করুন"} title={audioPlaying ? "ভয়েস বন্ধ করুন" : "ভয়েস চালু করুন"} className="ap-landing-audio group relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-all-product-gold/45 bg-white/90 text-all-product-primary shadow-[0_10px_28px_-14px_rgba(20,83,45,.65)] transition-all duration-300 hover:scale-105 hover:border-all-product-primary hover:bg-white active:scale-95">
                        <span className="absolute inset-0 rounded-full border border-all-product-gold/35 ap-audio-ring" aria-hidden="true" />
                        <span className="absolute inset-[-4px] rounded-full bg-all-product-gold/15 ap-audio-glow" aria-hidden="true" />
                        {audioPlaying ? <Volume2 className="relative h-5 w-5" /> : <VolumeX className="relative h-5 w-5" />}
                      </button>
                    </>
                  )}
                  <div className="shrink-0 text-right">
                    {discount > 0 && <span className="inline-flex rounded-full bg-all-product-alert px-3 py-1.5 text-xs font-black text-white shadow-md">{discount}% ছাড়</span>}
                    {savings > 0 && <span className="mt-1 block text-[11px] font-black text-all-product-success">সাশ্রয় {taka(savings)}</span>}
                  </div>
                </div>
                {isAudioLanding && C.audio_url && <style>{"@keyframes apAudioRing { 0%,100% { transform: scale(1); opacity:.35; } 50% { transform: scale(1.22); opacity:.9; } } @keyframes apAudioGlow { 0%,100% { transform: scale(.92); opacity:.25; } 50% { transform: scale(1.18); opacity:.65; } } .ap-audio-ring { animation: apAudioRing 1.25s ease-in-out infinite; } .ap-audio-glow { animation: apAudioGlow 1.55s ease-in-out infinite; } @media (prefers-reduced-motion:reduce) { .ap-audio-ring,.ap-audio-glow { animation:none!important; } }"}</style>}
              </div>
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-sm">
            <div className="px-2.5 py-3 text-center"><ShieldCheck className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">পরীক্ষিত বীজ</span></div>
            <div className="border-x border-white/10 px-2.5 py-3 text-center"><Truck className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">সারা দেশে ডেলিভারি</span></div>
            <div className="px-2.5 py-3 text-center"><Wallet className="mx-auto mb-1.5 h-5 w-5 text-all-product-success" /><span className="block text-[11px] font-bold leading-4 text-all-product-hero-muted">ক্যাশ অন ডেলিভারি</span></div>
          </div>

          <div className="mx-auto mt-4 max-w-xl text-center">
            <Button size="lg" onClick={handleCta} className="all-product-primary-cta h-13 w-full text-base font-black shadow-xl sm:h-14"><ShoppingBag className="h-5 w-5" />{isNutrimix ? "২৪ প্রকার বীজ ফ্রী নিন" : (page.cta_text || "এখনই অর্ডার করুন")}<span aria-hidden="true">→</span></Button>
            <p className="mt-2 text-[11px] font-bold text-all-product-hero-muted">ক্যাশ অন ডেলিভারি • সারা দেশে হোম ডেলিভারি</p>
          </div>
        </div>
        <ChevronDown className="absolute bottom-2 left-1/2 h-5 w-5 -translate-x-1/2 animate-bounce text-all-product-gold" />
      </section>

      {(detailRows.length > 0 || C.gallery_images.length > 0) && <section className="bg-all-product-muted-surface py-7"><div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-lg border border-all-product-line bg-all-product-surface shadow-all-product">
          <div className="flex items-center justify-center gap-2 border-b border-all-product-line bg-all-product-soft px-3.5 py-2 text-center"><Leaf className="h-4 w-4 shrink-0 text-all-product-primary" /><h2 className="text-[13.5px] font-black leading-5">প্রোডাক্ট বিস্তারিত</h2></div>
          {detailRows.length > 0 && <table className="w-full border-collapse text-left"><tbody>{detailRows.map((row, index) => { const [head, ...rest] = row.split(":"); const value = rest.join(":").trim(); return <tr key={index} className="border-b border-all-product-line/70 last:border-0"><td className="px-4 py-2.5 text-[12.5px] leading-6"><span className="mr-1.5 font-black text-all-product-primary">•</span><span className="font-black">{value ? head.trim() : row}</span>{value && <span className="text-all-product-muted"> — {value}</span>}</td></tr>; })}</tbody></table>}
          {C.gallery_images.length > 0 && <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3">{C.gallery_images.slice(0,3).map((image, index) => <SafeImage key={image + index} src={toImg(image, { w: 600, q: 82 })} alt={`${page.title} বিস্তারিত ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-md border border-all-product-line object-cover" />)}</div>}
        </div>
      </div></section>}

      {isNutrimix && <NutrimixNutrients />}

      <section className="bg-all-product-surface py-7"><div className="mx-auto max-w-3xl px-4">
        <div className="overflow-hidden rounded-xl border border-all-product-line bg-all-product-surface shadow-all-product">
          <div className="flex items-center justify-center gap-2 border-b border-all-product-line bg-all-product-soft px-4 py-2.5 text-center"><Sparkles className="h-4 w-4 shrink-0 text-all-product-primary" /><h2 className="text-[13.5px] font-black leading-5">{isNutrimix ? "ব্যবহারের উপকারিতা" : "প্রোডাক্ট বৈশিষ্ট্য"}</h2></div>
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

      {isNutrimix && (
        <div className="bg-all-product-surface px-4 pb-3 pt-1 text-center">
          <div className="mx-auto max-w-md">
            <Button size="lg" onClick={handleCta} className="all-product-primary-cta h-12 w-full text-base font-black shadow-lg">
              <ShoppingBag className="h-5 w-5" />ফ্রী ডেলিভারিতে অর্ডার করুন<span aria-hidden="true">→</span>
            </Button>
            <p className="mt-2 text-[11px] font-bold text-all-product-muted">সারা দেশে হোম ডেলিভারি • ক্যাশ অন ডেলিভারি</p>
          </div>
        </div>
      )}

      {isNutrimix && page.show_reviews !== false && Array.isArray(page.reviews) && page.reviews.length > 0 && (
        <NutrimixReviews reviews={page.reviews} themeColor={page.theme_color || undefined} />
      )}

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

              <div className="space-y-1.5">
                {offers.map((offer, index) => {
                  const active = selected === `offer-${index}`;
                  return (
                    <button
                      key={`${offer.name}-${index}`}
                      type="button"
                      onClick={() => setSelected(`offer-${index}`)}
                      aria-pressed={active}
                      className={`group relative flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 active:scale-[.995] ${active ? "border-all-product-primary bg-all-product-primary/[0.045] ring-1 ring-all-product-primary/15 shadow-[0_6px_18px_-14px_rgba(20,83,45,.5)]" : "border-all-product-line bg-all-product-surface hover:border-all-product-primary/40 hover:bg-all-product-soft/30"}`}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-all-product-soft ring-1 ring-black/[0.04] sm:h-14 sm:w-14">
                        <SafeImage src={toImg(offer.image || "/placeholder.svg", { w: 180, q: 82 })} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-black leading-5 text-all-product-ink sm:text-[12.5px]">{offer.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-[13px] font-black leading-4 text-all-product-primary">{taka(offer.price)}</span>
                          {offer.old && offer.old > offer.price && <del className="text-[9px] font-semibold text-all-product-muted">{taka(offer.old)}</del>}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold leading-none ${offer.delivery_fee === 0 ? "bg-all-product-success/10 text-all-product-success" : "bg-all-product-soft text-all-product-muted"}`}>
                          {offer.delivery_fee === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}
                        </span>
                        <span className={`grid h-5 w-5 place-items-center rounded-full border ${active ? "border-all-product-primary bg-all-product-primary text-all-product-primary-foreground" : "border-all-product-line bg-all-product-soft text-transparent"}`}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
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
                            <SafeImage src={toImg(offer.image || "/placeholder.svg", { w: 420, q: 80 })} alt={offer.name} loading="lazy" className="aspect-square w-full object-cover" />
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
     <div className="fixed inset-x-0 bottom-0 z-40 border-t border-all-product-line bg-all-product-surface/95 p-2 backdrop-blur-lg"><div className="mx-auto flex max-w-3xl items-center gap-2">{isSeedCombo && C.audio_url && <button type="button" onClick={toggleLandingAudio} aria-label={audioPlaying ? "ভয়েস বন্ধ করুন" : "ভয়েস চালু করুন"} title={audioPlaying ? "ভয়েস বন্ধ করুন" : "ভয়েস চালু করুন"} className="ap-landing-audio group relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-all-product-gold/45 bg-white/90 text-all-product-primary shadow-[0_10px_28px_-14px_rgba(20,83,45,.65)] transition-all duration-300 hover:scale-105 hover:border-all-product-primary hover:bg-white active:scale-95"><span className="absolute inset-0 rounded-full border border-all-product-gold/35 ap-audio-ring" aria-hidden="true" /><span className="absolute inset-[-4px] rounded-full bg-all-product-gold/15 ap-audio-glow" aria-hidden="true" />{audioPlaying ? <Volume2 className="relative h-5 w-5" /> : <VolumeX className="relative h-5 w-5" />}</button>}{formInView ? <Button type="submit" form="all-product-order-form" disabled={submitting} className="all-product-primary-cta h-12 flex-1 font-black"><ShieldCheck />{submitting ? "অর্ডার হচ্ছে..." : `অর্ডার টি কনফার্ম করুন — ${taka(total)}`}</Button> : <Button onClick={handleCta} className="all-product-primary-cta h-12 flex-1 font-black"><ShoppingBag />{page.cta_text || "এখনই অর্ডার করুন"}{selected ? ` — ${taka(total)}` : ""}</Button>}</div></div>
  </div>;
}


function NutrimixNutrients() {
  const [active, setActive] = useState<string | null>(null);
  const nutrients = [
    { symbol: "Mg", name: "Magnesium", bn: "ম্যাগনেসিয়াম", role: "ক্লোরোফিল ও পাতার সবুজভাব", benefit: "ক্লোরোফিল তৈরিতে সহায়তা করে এবং পাতাকে সবুজ ও সতেজ রাখতে ভূমিকা রাখে।", tone: "from-emerald-50 via-white to-lime-50", ring: "border-emerald-100", accent: "text-emerald-700", icon: "🌿" },
    { symbol: "Ca", name: "Calcium", bn: "ক্যালসিয়াম", role: "কোষ ও নতুন বৃদ্ধির শক্তি", benefit: "গাছের কোষের গঠন ও নতুন টিস্যুর স্বাভাবিক বিকাশে গুরুত্বপূর্ণ ভূমিকা রাখে।", tone: "from-sky-50 via-white to-cyan-50", ring: "border-sky-100", accent: "text-sky-700", icon: "🌱" },
    { symbol: "Na", name: "Sodium", bn: "সোডিয়াম", role: "পানি ও আয়ন ভারসাম্য", benefit: "কিছু উদ্ভিদের ক্ষেত্রে পানি ও আয়নের ভারসাম্য বজায় রাখতে ভূমিকা রাখতে পারে।", tone: "from-cyan-50 via-white to-blue-50", ring: "border-cyan-100", accent: "text-cyan-700", icon: "💧" },
    { symbol: "S", name: "Sulfur", bn: "সালফার", role: "প্রোটিন ও এনজাইম গঠন", benefit: "প্রোটিন ও গুরুত্বপূর্ণ যৌগ তৈরিতে সহায়তা করে এবং গাছের স্বাভাবিক বৃদ্ধি ও বিপাকীয় কার্যক্রমকে সমর্থন করে।", tone: "from-amber-50 via-white to-yellow-50", ring: "border-amber-100", accent: "text-amber-700", icon: "✨" },
    { symbol: "B", name: "Boron", bn: "বোরন", role: "ফুল, পরাগায়ন ও নতুন টিস্যু", benefit: "ফুল ও প্রজনন অঙ্গের স্বাভাবিক বিকাশ, পরাগায়ন এবং নতুন টিস্যু গঠনে গুরুত্বপূর্ণ ভূমিকা রাখে।", tone: "from-rose-50 via-white to-orange-50", ring: "border-rose-100", accent: "text-rose-700", icon: "🌸" },
    { symbol: "Zn", name: "Zinc", bn: "জিংক", role: "এনজাইম ও স্বাভাবিক বৃদ্ধি", benefit: "বিভিন্ন এনজাইমের কার্যক্রম ও উদ্ভিদের স্বাভাবিক বৃদ্ধি নিয়ন্ত্রণকারী প্রক্রিয়াকে সমর্থন করে।", tone: "from-teal-50 via-white to-emerald-50", ring: "border-teal-100", accent: "text-teal-700", icon: "🍃" },
  ];
  return (
    <section className="bg-all-product-muted-surface px-3 pb-3 pt-2 sm:px-4 sm:pb-5">
      <style>{`@keyframes apNutriFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes apNutriGlow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.75;transform:scale(1.08)}}@keyframes apNutriShine{0%{transform:translateX(-130%)}55%,100%{transform:translateX(130%)}}.ap-nutri-float{animation:apNutriFloat 3.8s ease-in-out infinite}.ap-nutri-glow{animation:apNutriGlow 3s ease-in-out infinite}.ap-nutri-shine{animation:apNutriShine 5.5s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ap-nutri-float,.ap-nutri-glow,.ap-nutri-shine{animation:none!important}}`}</style>
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-[24px] border border-all-product-gold/25 bg-gradient-to-br from-white via-all-product-soft to-all-product-gold/[0.10] p-4 shadow-[0_18px_55px_-28px_rgba(20,83,45,.55)] sm:p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl ap-nutri-glow" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-all-product-gold/15 blur-3xl ap-nutri-glow" />
          <div className="relative">
            <div className="mb-4 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-all-product-gold/30 bg-white/80 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-all-product-gold-foreground shadow-sm"><Sparkles className="h-3 w-3" /> Premium Nutrient Blend</span>
              <h2 className="mt-2 text-lg font-black tracking-tight text-all-product-ink sm:text-2xl">NUTRIMIX-এ রয়েছে ৬টি প্রয়োজনীয় পুষ্টি উপাদান</h2>
              <p className="mx-auto mt-1.5 max-w-2xl text-[10.5px] font-semibold leading-5 text-all-product-muted sm:text-xs">গাছের সবুজভাব, নতুন বৃদ্ধি, ফুল ও সামগ্রিক পুষ্টি ব্যবস্থাপনায় প্রয়োজনীয় বিভিন্ন উপাদানের সমন্বিত ব্লেন্ড।</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {nutrients.map((item) => (
                <article key={item.symbol} className={"ap-nutri-float group relative overflow-hidden rounded-2xl border " + item.ring + " bg-gradient-to-br " + item.tone + " p-3 shadow-[0_10px_26px_-20px_rgba(15,23,42,.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_-20px_rgba(15,23,42,.42)]"}>
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent ap-nutri-shine" />
                  <div className="relative flex items-start gap-2.5">
                    <div className="relative shrink-0"><div className="absolute inset-0 rounded-xl bg-white/70 blur-md ap-nutri-glow" /><div className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/80 bg-white/90 text-lg shadow-sm">{item.icon}</div><span className={"absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1 text-[9px] font-black shadow ring-1 ring-black/5 " + item.accent}>{item.symbol}</span></div>
                    <div className="min-w-0"><h3 className="text-[13px] font-black leading-4 text-all-product-ink sm:text-sm">{item.bn}</h3><p className={"mt-0.5 text-[9px] font-extrabold uppercase tracking-wide " + item.accent}>{item.name}</p></div>
                  </div>
                  <div className="relative mt-2.5 rounded-xl border border-white/80 bg-white/65 px-2.5 py-2"><p className="text-[9.5px] font-black leading-4 text-all-product-ink">✦ {item.role}</p><p className="mt-1 text-[9.5px] font-semibold leading-[1.55] text-all-product-muted">{item.benefit}</p></div>
                </article>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white/75 px-3 py-2.5 text-center shadow-sm"><Leaf className="h-4 w-4 shrink-0 text-emerald-600" /><p className="text-[9.5px] font-bold leading-4 text-all-product-muted sm:text-[10px]"><span className="font-black text-emerald-700">৬ উপাদান, একসাথে:</span> গাছের প্রয়োজনীয় পুষ্টি ব্যবস্থাপনাকে আরও সম্পূর্ণভাবে সাপোর্ট করার জন্য তৈরি।</p></div>
            <button type="button" onClick={() => document.getElementById("all-product-order-form")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="group relative mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-all-product-primary px-5 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-14px_rgba(16,185,129,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_rgba(16,185,129,.8)] active:scale-[.99]">
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <ShoppingBag className="relative h-5 w-5" />
              <span className="relative">{"এখনই অর্ডার করুন"}</span>
              <span className="relative text-lg leading-none transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
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

    let backTimer: number | undefined;
    const upTimer = window.setTimeout(() => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 8) return;

      // Give the visitor a clear preview of the lower packages, then return
      // smoothly to the top. Keep this animation contained inside the popup.
      const previewTop = Math.min(max, Math.max(180, Math.round(max * 0.8)));
      el.scrollTo({ top: previewTop, behavior: "smooth" });
      backTimer = window.setTimeout(() => {
        el.scrollTo({ top: 0, behavior: "smooth" });
      }, 1200);
    }, 500);

    return () => {
      window.clearTimeout(upTimer);
      if (backTimer !== undefined) window.clearTimeout(backTimer);
    };
  }, [offers.length, comboOffers.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/68 px-2.5 py-3 backdrop-blur-[8px] sm:px-4 sm:py-5"
      role="dialog"
      aria-modal="true"
      aria-label="প্যাকেজ নির্বাচন করুন"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={popupRef}
        className="flex max-h-[84vh] w-full max-w-[470px] flex-col overflow-y-auto overscroll-contain rounded-[28px] border border-white/70 bg-all-product-surface shadow-[0_36px_120px_-34px_rgba(0,0,0,.82)] ring-1 ring-black/5"
      >
        <div className="sticky top-0 z-20 shrink-0 border-b border-all-product-line/80 bg-gradient-to-br from-all-product-primary/[0.07] via-all-product-surface to-all-product-gold/[0.08] px-4 pb-3.5 pt-4 shadow-[0_10px_28px_-20px_rgba(0,0,0,.5)] backdrop-blur-xl sm:px-5">
          <div className="flex items-start gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br from-all-product-primary to-all-product-primary/80 text-all-product-primary-foreground shadow-[0_10px_24px_-12px_rgba(20,83,45,.75)]">
              <PackageCheck className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-all-product-gold text-[8px] font-black text-white ring-2 ring-all-product-surface">✓</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-[20px] font-black leading-6 tracking-[-0.01em] text-all-product-ink sm:text-[21px]">প্যাকেজ নির্বাচন করুন</h3>
              <p className="mt-1 text-[11.5px] font-semibold leading-5 text-all-product-muted">অর্ডার করতে একটি প্যাকেজ বেছে নিন</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-all-product-line bg-all-product-soft text-all-product-ink shadow-sm transition-all hover:border-all-product-primary hover:bg-all-product-primary hover:text-all-product-primary-foreground active:scale-95" aria-label="বন্ধ করুন">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-all-product-primary/10 bg-all-product-primary/[0.045] px-3 py-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-all-product-primary shadow-[0_0_0_4px_rgba(20,83,45,.08)]" />
            <span className="text-[10px] font-bold text-all-product-muted">পছন্দের প্যাকেজে চাপ দিন — অর্ডার ফর্মে সরাসরি চলে যাবে</span>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:p-3.5">
          {offers.length > 0 && (
            <section>
              <div className="grid grid-cols-2 gap-2">
                {offers.map((offer, index) => {
                  const value = `offer-${index}`;
                  const active = selected === value;
                  return (
                    <button key={value} type="button" onClick={() => onSelect(value)} aria-pressed={active}
                      className={`group relative min-w-0 overflow-hidden rounded-[16px] border bg-all-product-surface p-1.5 text-center transition-all duration-200 active:scale-[.985] ${
                        active ? "border-all-product-primary bg-all-product-primary/[0.045] ring-1 ring-all-product-primary/15 shadow-[0_10px_24px_-16px_rgba(20,83,45,.65)]" : "border-all-product-line hover:border-all-product-primary/45 hover:shadow-[0_10px_24px_-18px_rgba(0,0,0,.3)]"
                      }`}>
                      <div className="relative overflow-hidden rounded-[14px] bg-all-product-soft ring-1 ring-black/[0.035]">
                        <SafeImage src={toImg(offer.image || "/placeholder.svg", { w: 520, q: 84 })} alt={offer.name} loading="lazy" className="aspect-[1.08/1] w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                      </div>
                      <div className="px-0.5 pb-0.5 pt-1">
                        <div className="min-h-[30px] break-words text-[12.5px] font-black leading-[1.3] text-all-product-ink">{offer.name}</div>
                        <div className="mt-1 flex items-baseline justify-center gap-1.5">
                          <span className="text-[17px] font-black leading-none text-all-product-primary">{taka(offer.price)}</span>
                          {offer.old && offer.old > offer.price && <del className="text-[10px] font-semibold leading-none text-all-product-muted">{taka(offer.old)}</del>}
                        </div>
                        <div className="mt-1 text-[10px] font-bold leading-none text-all-product-success">{offer.delivery_fee === 0 ? "ডেলিভারি ফ্রি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {comboOffers.length > 0 && (
            <section className="border-t border-all-product-line pt-3">
              <div className="mb-2 flex items-center justify-center gap-1 text-center">
                <h4 className="text-[12px] font-black text-all-product-ink">কম্বো অফার <span className="font-semibold text-all-product-muted">(আরও সাশ্রয়)</span></h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {comboOffers.map((offer, index) => {
                  const value = `combo-${index}`;
                  const active = selected === value;
                  return (
                    <button key={value} type="button" onClick={() => onSelect(value)} aria-pressed={active}
                      className={`group relative overflow-hidden rounded-[14px] border bg-all-product-surface p-1.5 text-left transition-all active:scale-[.985] ${
                        active ? "border-all-product-primary ring-1 ring-all-product-primary/15 shadow-[0_10px_24px_-16px_rgba(20,83,45,.65)]" : "border-all-product-line hover:border-all-product-primary/45 hover:shadow-[0_8px_20px_-16px_rgba(0,0,0,.28)]"
                      }`}>
                      <div className="relative overflow-hidden rounded-[12px] bg-all-product-soft">
                        <SafeImage src={toImg(offer.image || "/placeholder.svg", { w: 520, q: 82 })} alt={offer.name} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
                      </div>
                      <div className="px-0.5 pb-0.5 pt-1">
                        <div className="min-h-[30px] break-words text-[12.5px] font-black leading-[1.3] text-all-product-ink">{offer.name}</div>
                        <div className="mt-1 flex items-center justify-between gap-1.5">
                          <span className="min-w-0 truncate rounded-full bg-all-product-primary/10 px-1.5 py-0.5 text-[9px] font-black leading-none text-all-product-primary">{offer.quantity || "১ পিস"}</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[17px] font-black leading-none text-all-product-primary">{taka(offer.price)}</span>
                            {offer.old && offer.old > offer.price && <del className="text-[10px] font-semibold leading-none text-all-product-muted">{taka(offer.old)}</del>}
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] font-bold leading-none text-all-product-success">{offer.delivery_fee === 0 ? "ডেলিভারি ফ্রি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</div>
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