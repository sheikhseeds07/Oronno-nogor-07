import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Check, ChevronDown, Leaf, MapPin, PackageCheck, Phone, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, User, Wallet } from "lucide-react";
import { supabase } from "@/lib/personal-supabase/client";
import { placeOrder } from "@/lib/place-order.functions";
import { useCheckoutAutofill } from "@/lib/useCheckoutAutofill";
import { taka } from "@/lib/format";
import { toast } from "sonner";
import { orderErrorMessage } from "@/lib/order-block";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { getFbContext } from "@/lib/fb-context";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { mergeContent, DEFAULT_FEATURES, DEFAULT_WHY, type Feature, type WhyItem } from "@/lib/landing-content";
import { toImg, imgFallback } from "@/lib/img";
import { isValidBdPhone, phoneSubmitError } from "@/lib/bd-phone";
import { Button } from "@/components/ui/button";
import brandLogoFile from "@/assets/logo.jpg";

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; badge?: string; delivery_fee?: number | null };
type Page = { id: string; slug: string; title: string; top_bar_text?: string | null; hero_title?: string | null; hero_subtitle?: string | null; hero_image?: string | null; cta_text?: string | null; regular_price?: number | null; sale_price?: number | null; main_delivery_fee?: number | null; features?: Feature[] | null; why_choose_us?: WhyItem[] | null; addons?: Addon[] | null; theme_color?: string | null; planting_steps?: unknown; description?: string | null; is_published?: boolean; products?: Product | null };
type Offer = { name: string; price: number; old?: number | null; image?: string; product_id?: string; delivery_fee: number; badge?: string };

export function AllProductLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const { data: page, isLoading } = useQuery({ queryKey: ["landing-all-product", slug], queryFn: async () => (await supabase.from("landing_pages").select("*, products(id,name,price,sale_price,images)").eq("slug", slug).eq("is_published", true).maybeSingle()).data as Page | null });
  const { data: settingsRow } = useQuery({ queryKey: ["site-settings-public"], queryFn: async () => (await supabase.from("site_settings").select("settings").maybeSingle()).data });
  const settings = (settingsRow?.settings as { site_name?: string; tagline?: string; logo_url?: string }) ?? {};
  const product = page?.products ?? null;
  const C = mergeContent(page?.planting_steps);
  const heroImage = page?.hero_image || product?.images?.[0] || "/placeholder.svg";
  const basePrice = Number(page?.sale_price ?? product?.sale_price ?? page?.regular_price ?? product?.price ?? 0);
  const regularPrice = Number(page?.regular_price ?? product?.price ?? 0) || null;
  const delivery = Number(page?.main_delivery_fee ?? 70);
  const offers = useMemo<Offer[]>(() => {
    const main = product ? [{ name: product.name, price: basePrice, old: regularPrice, image: heroImage, product_id: product.id, delivery_fee: delivery, badge: "জনপ্রিয়" }] : [];
    return [...main, ...(page?.addons ?? []).map((item) => ({ name: item.name, price: Number(item.price), old: item.old_price, image: item.image, product_id: item.product_id, delivery_fee: item.delivery_fee == null ? delivery : Number(item.delivery_fee), badge: item.badge }))];
  }, [product, page?.addons, basePrice, regularPrice, heroImage, delivery]);
  const current = offers[selected] ?? offers[0];
  const subtotal = current?.price ?? 0;
  const shipping = current?.delivery_fee ?? delivery;
  const total = subtotal + shipping;
  const brand = settings.site_name || "Sheikh Seeds";
  const logo = settings.logo_url || brandLogoFile;
  const features = page?.features?.length ? page.features : DEFAULT_FEATURES;
  const why = page?.why_choose_us?.length ? page.why_choose_us : DEFAULT_WHY;
  const savings = regularPrice && regularPrice > basePrice ? regularPrice - basePrice : 0;
  const discount = savings && regularPrice ? Math.round((savings / regularPrice) * 100) : 0;

  useCheckoutAutofill({ form, setForm: updater => setForm(value => updater(value) as typeof value), items: current ? [{ id: current.product_id || `offer-${selected}`, name: current.name, price: current.price, quantity: 1 }] : [], subtotal, total, deliveryFee: shipping });
  useEffect(() => { if (selected >= offers.length) setSelected(0); }, [offers.length, selected]);

  const goOrder = () => document.getElementById("all-product-order")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    } catch (error) { toast.error(orderErrorMessage(error)); setSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-all-product-surface" aria-hidden="true" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-all-product-surface text-all-product-ink">পেজ পাওয়া যায়নি</div>;

  return <div className="all-product-landing min-h-screen bg-all-product-surface text-all-product-ink">
    <FacebookPixel eager />
    {page.top_bar_text && <div className="bg-all-product-alert px-4 py-2 text-center text-sm font-bold text-all-product-alert-foreground">{page.top_bar_text}</div>}
    <div role="banner" className="sticky top-0 z-40 border-b border-all-product-line bg-all-product-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5"><img src={logo} alt={brand} className="h-10 w-10 rounded-full border border-all-product-line object-cover" /><div className="min-w-0"><div className="flex items-center gap-1 font-black"><span className="truncate">{brand}</span><BadgeCheck className="h-4 w-4 text-all-product-primary" fill="currentColor" /></div><p className="truncate text-[10px] font-semibold text-all-product-muted">অরিজিনাল বীজ • বিশ্বস্ত সেবা</p></div></div>
        <div className="flex items-center gap-1.5 text-xs font-black text-all-product-alert"><span className="all-product-live-dot h-2 w-2 rounded-full bg-all-product-alert" /> অফার চলছে</div>
      </div>
    </div>

    <main>
      <section className="relative overflow-hidden bg-all-product-hero text-all-product-hero-foreground">
        <div className="all-product-grain absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-7 px-4 pb-10 pt-8 md:grid-cols-[1fr_.9fr] md:pb-14 md:pt-12">
          <div className="order-2 md:order-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-all-product-gold/40 bg-all-product-gold/10 px-3 py-1.5 text-xs font-black text-all-product-gold"><Sparkles className="h-3.5 w-3.5" /> {C.offer_badge_text || "সীমিত সময়ের বিশেষ অফার"}</div>
            <h1 className="max-w-2xl text-3xl font-black leading-[1.18] sm:text-4xl md:text-5xl">{page.hero_title || page.title}</h1>
            {page.hero_subtitle && <p className="mt-4 max-w-xl text-sm leading-7 text-all-product-hero-muted sm:text-base">{page.hero_subtitle}</p>}
            <div className="mt-5 flex flex-wrap items-end gap-3"><span className="text-4xl font-black text-all-product-gold">{taka(basePrice)}</span>{regularPrice && regularPrice > basePrice && <><del className="pb-1 text-lg text-all-product-hero-muted">{taka(regularPrice)}</del><span className="mb-1 rounded-md bg-all-product-alert px-2 py-1 text-xs font-black text-all-product-alert-foreground">{discount}% ছাড়</span></>}</div>
            {savings > 0 && <p className="mt-1 text-sm font-bold text-all-product-hero-muted">আপনার সাশ্রয় {taka(savings)}</p>}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-all-product-hero-muted"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-all-product-success" /> পরীক্ষিত বীজ</span><span className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-all-product-success" /> সারা দেশে ডেলিভারি</span><span className="flex items-center gap-1.5"><Wallet className="h-4 w-4 text-all-product-success" /> ক্যাশ অন ডেলিভারি</span></div>
            <Button size="lg" onClick={goOrder} className="all-product-primary-cta mt-7 h-14 w-full max-w-sm text-base font-black"><ShoppingBag className="h-5 w-5" />{page.cta_text || "এখনই অর্ডার করুন"}<span aria-hidden="true">→</span></Button>
          </div>
          <div className="order-1 md:order-2"><div className="all-product-image-wrap mx-auto max-w-lg"><img src={toImg(heroImage, { w: 1100, q: 88 })} onError={event => imgFallback(event, heroImage)} alt={page.hero_title || page.title} width={760} height={760} fetchPriority="high" className="aspect-square w-full object-cover" /><span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md bg-all-product-surface/95 px-3 py-2 text-xs font-black text-all-product-primary shadow-lg"><Leaf className="h-4 w-4" /> ১০০% অরিজিনাল</span></div></div>
        </div>
        <ChevronDown className="absolute bottom-2 left-1/2 h-5 w-5 -translate-x-1/2 animate-bounce text-all-product-gold" />
      </section>

      <section className="border-b border-all-product-line bg-all-product-surface py-6"><div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-4">{features.slice(0,4).map((feature, index) => <div key={index} className="flex items-start gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-all-product-soft text-lg">{feature.icon || ["🌱","✓","🚚","🛡️"][index]}</span><div><h2 className="text-sm font-black leading-5">{feature.title}</h2>{feature.text && <p className="mt-0.5 hidden text-xs leading-5 text-all-product-muted sm:block">{feature.text}</p>}</div></div>)}</div></section>

      {(page.description || C.gallery_images.length > 0) && <section className="bg-all-product-muted-surface py-10"><div className="mx-auto max-w-6xl px-4"><div className="mb-6 max-w-2xl"><span className="text-xs font-black uppercase text-all-product-primary">পণ্য সম্পর্কে বিস্তারিত</span><h2 className="mt-1 text-2xl font-black sm:text-3xl">ভালো ফলনের শুরু হোক সঠিক বীজে</h2>{page.description && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-all-product-muted">{page.description}</p>}</div>{C.gallery_images.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{C.gallery_images.map((image, index) => <img key={image + index} src={toImg(image, { w: 900, q: 84 })} alt={`${page.title} বিস্তারিত ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-md border border-all-product-line object-cover" />)}</div>}</div></section>}

      <section className="bg-all-product-surface py-10"><div className="mx-auto max-w-6xl px-4"><div className="mb-6 text-center"><span className="text-xs font-black text-all-product-primary">আমাদের নিশ্চয়তা</span><h2 className="mt-1 text-2xl font-black sm:text-3xl">নিশ্চিন্তে অর্ডার করুন</h2></div><div className="grid gap-px overflow-hidden rounded-md border border-all-product-line bg-all-product-line sm:grid-cols-2 lg:grid-cols-4">{why.slice(0,4).map((item, index) => <div key={index} className="bg-all-product-surface p-5"><span className="mb-3 grid h-10 w-10 place-items-center rounded-md bg-all-product-soft text-xl">{item.icon || ["💵","🚚","🛡️","☎️"][index]}</span><h3 className="font-black">{item.title}</h3>{item.text && <p className="mt-1 text-sm leading-6 text-all-product-muted">{item.text}</p>}</div>)}</div></div></section>

      <section id="all-product-order" className="scroll-mt-20 bg-all-product-checkout py-10 sm:py-14"><div className="mx-auto max-w-3xl px-4"><div className="mb-6 text-center"><span className="inline-flex items-center gap-1.5 rounded-full bg-all-product-primary px-3 py-1.5 text-xs font-black text-all-product-primary-foreground"><PackageCheck className="h-4 w-4" /> মাত্র ৩০ সেকেন্ডে অর্ডার</span><h2 className="mt-3 text-3xl font-black">এখনই অর্ডার করুন</h2><p className="mt-1 text-sm text-all-product-muted">২–৪ দিনের মধ্যে সারা বাংলাদেশে হোম ডেলিভারি</p></div>
        <form onSubmit={submit} className="overflow-hidden rounded-lg border border-all-product-line bg-all-product-surface shadow-all-product">
          <div className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">১</span><h3 className="font-black">আপনার তথ্য দিন</h3></div><div className="grid gap-4 sm:grid-cols-2"><CheckoutField label="আপনার নাম" icon={<User />}><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="আপনার পুরো নাম" /></CheckoutField><CheckoutField label="মোবাইল নম্বর" icon={<Phone />}><input required type="tel" inputMode="numeric" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value.replace(/[^\d]/g, "").slice(0, 16) })} placeholder="01XXXXXXXXX" /></CheckoutField><div className="sm:col-span-2"><CheckoutField label="সম্পূর্ণ ঠিকানা" icon={<MapPin />}><textarea required rows={2} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="গ্রাম/এলাকা, থানা, জেলা" /></CheckoutField></div></div></div>
          <div className="border-b border-all-product-line p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">২</span><h3 className="font-black">অফার সিলেক্ট করুন</h3></div><div className="grid gap-2.5">{offers.map((offer, index) => { const active = selected === index; return <Button key={`${offer.name}-${index}`} type="button" variant="outline" onClick={() => setSelected(index)} className={`all-product-offer h-auto min-h-20 justify-start whitespace-normal p-3 text-left ${active ? "is-selected" : ""}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-all-product-line">{active && <Check className="h-3 w-3" />}</span>{offer.image && <img src={toImg(offer.image, { w: 120, q: 75 })} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" />}<span className="min-w-0 flex-1"><span className="block font-black">{offer.name}</span><span className="mt-1 block text-xs font-semibold text-all-product-muted">{offer.delivery_fee === 0 ? "ফ্রি ডেলিভারি" : `ডেলিভারি ${taka(offer.delivery_fee)}`}</span></span><span className="shrink-0 text-right"><span className="block text-lg font-black text-all-product-primary">{taka(offer.price)}</span>{offer.old && offer.old > offer.price && <del className="block text-xs text-all-product-muted">{taka(offer.old)}</del>}{offer.badge && <span className="mt-1 block rounded-sm bg-all-product-gold px-1.5 py-0.5 text-[10px] font-black text-all-product-gold-foreground">{offer.badge}</span>}</span></Button>; })}</div></div>
          <div className="p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-all-product-primary text-sm font-black text-all-product-primary-foreground">৩</span><h3 className="font-black">পেমেন্ট ও অর্ডার</h3></div><div className="mb-4 flex items-center gap-3 rounded-md border border-all-product-primary/30 bg-all-product-soft p-3"><Wallet className="h-5 w-5 text-all-product-primary" /><div className="flex-1"><div className="text-sm font-black">ক্যাশ অন ডেলিভারি</div><div className="text-xs text-all-product-muted">পণ্য হাতে পেয়ে টাকা দিন</div></div><Check className="h-5 w-5 text-all-product-primary" /></div><div className="mb-4 divide-y divide-all-product-line rounded-md border border-all-product-line text-sm"><div className="flex justify-between p-3"><span className="text-all-product-muted">পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div><div className="flex justify-between p-3"><span className="text-all-product-muted">ডেলিভারি</span><b>{shipping === 0 ? "ফ্রি" : taka(shipping)}</b></div><div className="flex justify-between bg-all-product-soft p-3 text-base"><span className="font-black">সর্বমোট</span><b className="text-all-product-primary">{taka(total)}</b></div></div><Button type="submit" disabled={submitting} className="all-product-primary-cta h-14 w-full text-base font-black"><ShieldCheck className="h-5 w-5" />{submitting ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন — ${taka(total)}`}</Button><p className="mt-3 text-center text-xs font-semibold text-all-product-muted">কোনো অগ্রিম পেমেন্ট লাগবে না • অর্ডারের পর কল করে নিশ্চিত করা হবে</p></div>
        </form>
      </div></section>
    </main>
    <div role="contentinfo" className="bg-all-product-hero px-4 py-6 text-center text-xs text-all-product-hero-muted">© {new Date().getFullYear()} {brand} — বিশ্বস্ত বীজ, সুন্দর ভবিষ্যৎ</div>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-all-product-line bg-all-product-surface/95 p-2 backdrop-blur-lg md:hidden"><Button onClick={goOrder} className="all-product-primary-cta h-12 w-full font-black"><ShoppingBag />{page.cta_text || "অর্ডার করুন"} — {taka(basePrice)}</Button></div>
  </div>;
}

function CheckoutField({ label, icon, children }: { label: string; icon: ReactNode; children: ReactElement<{ className?: string }> }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold">{label} <span className="text-all-product-alert">*</span></span><span className="all-product-field relative block"><span className="pointer-events-none absolute left-3 top-3.5 text-all-product-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>{children}</span></label>;
}