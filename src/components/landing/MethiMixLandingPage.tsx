import { SafeImage } from "@/components/SafeImage";
import { FacebookPixel } from "@/components/layout/FacebookPixel";
import { placeLandingOrder } from "@/lib/place-order.functions";
import { getFbContext } from "@/lib/fb-context";
import { notifyOrderError } from "@/lib/order-block";
import { taka } from "@/lib/format";
import { toImg } from "@/lib/img";
import { LANDING_PAGES_COLUMNS, LANDING_PRODUCT_COLUMNS } from "@/lib/read-columns";
import { supabase } from "@/lib/personal-supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, ChevronDown, CircleHelp, PackageCheck,
  ShieldCheck, ShoppingBag, Sprout, Truck,
} from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { toast } from "sonner";

type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; delivery_fee?: number | null };
type Package = { id: string; name: string; price: number; oldPrice: number | null; image: string; deliveryFee: number };

const FAQS = [
  { q: "মেথি মিক্স কী এবং এর কাজ কী?", a: "মেথি মিক্স বিভিন্ন ভেষজ ও মসলাজাতীয় উপাদানের সমন্বয়ে তৈরি একটি খাদ্যপণ্য। এটি কোনো নির্দিষ্ট রোগ সারায় বা গ্যাস্ট্রিকের চিকিৎসা করে—এমন প্রমাণিত দাবি করা যায় না। পেটের অস্বস্তি বা হজমের সমস্যা নিয়মিত হলে চিকিৎসকের পরামর্শ নিন।" },
  { q: "এতে কী কী উপাদান রয়েছে?", a: "উপাদানের সম্পূর্ণ ও নির্ভুল তালিকা জানতে পণ্যের ফাইলের লেবেল দেখুন।" },
  { q: "এটি কি ওষুধ? জেনে রাখুন", a: "এটি খাদ্য সম্পূরক, ওষুধ নয়। গর্ভবতী, স্তন্যদানকারী মা, শিশু বা নিয়মিত ওষুধ সেবনকারী হলে খাওয়ার আগে চিকিৎসকের পরামর্শ নিন।" },
];

export function MethiMixLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeLandingOrder);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  const { data: page, isLoading } = useQuery({
    queryKey: ["landing-methi-mix", slug],
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => (await supabase.from("landing_pages").select(LANDING_PAGES_COLUMNS + ", products(" + LANDING_PRODUCT_COLUMNS + ")").eq("slug", slug).eq("is_published", true).maybeSingle()).data,
  });
  useEffect(() => {
    if (isLoading || !page) return;
    const target = document.getElementById("methi-checkout-form");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsCheckoutVisible(entry.isIntersecting);
    }, { threshold: 0, rootMargin: "0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [isLoading, page]);
  const product = (page?.products ?? null) as Product | null;
  const addons = (Array.isArray(page?.addons) ? page.addons : []) as Addon[];
  const heroImage = page?.hero_image || product?.images?.[0] || "";
  const packages = useMemo<Package[]>(() => {
    if (product) return [{ id: product.id, name: product.name, price: 599, oldPrice: null, image: heroImage, deliveryFee: 0 }];
    return addons.slice(0, 1).map((addon, index) => ({
      id: addon.product_id || "addon-" + index, name: addon.name, price: Number(addon.price),
      oldPrice: null, image: addon.image || heroImage, deliveryFee: 0,
    }));
  }, [product, addons, heroImage]);
  const chosen = packages[0];
  const subtotal = (chosen?.price || 599) * quantity;
  const shipping = 0;
  const total = subtotal;
  const scrollOrder = () => document.getElementById("methi-order")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return toast.error("নাম, ফোন নম্বর ও ঠিকানা পূরণ করুন");
    if (!chosen || !chosen.id || chosen.price <= 0) return toast.error("পণ্যের প্যাকেজ Admin থেকে যুক্ত করতে হবে");
    setSubmitting(true);
    try {
      const items = [{ id: chosen.id, name: "১ ফাইল + ১ ফাইল ফ্রি", price: 599, quantity }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: {
        landing_slug: slug, customer_name: form.name.trim(),
        customer_phone: form.phone.replace(/[\\s-]/g, ""),
        customer_address: form.address.trim(), delivery_fee: 0, items,
        source_url: typeof window !== "undefined" ? window.location.href : null,
        ...getFbContext(),
      } });
      trackPurchase(items, total, order.id);
      toast.success("আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (error) {
      notifyOrderError(error);
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#fbfdf9] animate-pulse" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-[#fbfdf9] p-6 text-center"><div><h1 className="text-xl font-black">মেথি মিক্স পেজটি পাওয়া যায়নি</h1><p className="mt-2 text-sm text-slate-600">Admin থেকে পেজটি Publish করুন।</p></div></div>;

  return <div className="methi-mix-page min-h-screen overflow-hidden bg-[#fbfdf9] pb-20 text-[#24432d]">
    <FacebookPixel eager />
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
      .methi-mix-page{font-family:'Hind Siliguri','Anek Bangla',sans-serif}.methi-mix-page .methi-hero-title{font-family:'Anek Bangla','Hind Siliguri',sans-serif;font-weight:800;letter-spacing:-.025em}
      .methi-mix-page button,.methi-mix-page input,.methi-mix-page textarea{font:inherit}
      .methi-mix-page .methi-card{border:1px solid #dce9d8;background:#fff;border-radius:18px}
      @media(prefers-reduced-motion:no-preference){.methi-mix-page .methi-card{transition:transform .2s ease,box-shadow .2s ease}.methi-mix-page .methi-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px #24432d12}}
    `}</style>
    <main className="mx-auto max-w-4xl px-4">
      <section className="py-5 sm:py-8">
        <h1 className="methi-hero-title mb-4 text-center text-3xl font-extrabold leading-[1.2] text-[#24432d] sm:text-4xl">
          মেথি মিক্স পাউডার
          <span className="mt-2 block text-xl font-extrabold text-[#477b4d] sm:text-2xl">১ ফাইলের সাথে ১ ফাইল ফ্রি</span>
        </h1>
        <div className="relative mx-auto max-w-[440px] overflow-hidden rounded-[26px] border border-[#c9ddc3] bg-[#f3f8ef] p-2 shadow-[0_14px_40px_#24432d14]">
          {heroImage ? <SafeImage src={toImg(heroImage,{w:880,q:88})} alt={page.title || "মেথি মিক্স পাউডার"} className="aspect-square w-full rounded-[20px] object-cover"/> :
            <div className="grid aspect-square place-items-center rounded-[20px] bg-gradient-to-br from-[#e7f1e1] to-[#fecdd3] text-[#477b4d]"><div className="text-center"><Sprout size={58} className="mx-auto mb-2"/><div className="text-lg font-bold">মেথি মিক্স</div></div></div>}
        </div>
      </section>

      <section aria-labelledby="methi-benefits-title" className="mx-auto -mt-1 mb-7 max-w-2xl overflow-hidden rounded-[24px] border border-[#dce9d8] bg-[linear-gradient(145deg,#f7fbf3_0%,#edf5e9_52%,#f8faf3_100%)] shadow-[0_14px_38px_#24452a12]">
        <div className="relative overflow-hidden px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="pointer-events-none absolute -right-7 -top-8 h-28 w-28 rounded-full bg-[#dcebd3]/70 blur-2xl" />
          <div className="relative flex items-center justify-center gap-2 text-[#52764d]">
            <Sprout size={19} strokeWidth={2.2} />
            <span className="text-[11px] font-bold tracking-[.16em]">HERBAL CARE</span>
            <Sprout size={19} strokeWidth={2.2} className="scale-x-[-1]" />
          </div>
          <h2 id="methi-benefits-title" className="methi-hero-title mt-1 text-center text-[23px] font-extrabold text-[#24452a] sm:text-[26px]">মেথি মিক্স পাউডারের উপকারিতা</h2>
          <p className="mt-1 text-center text-xs text-[#6b8066]">প্রতিদিনের খাবারের সঙ্গে ভেষজ উপাদানের সমন্বয়</p>
        </div>
        <div className="mx-3 mb-3 overflow-hidden rounded-[17px] border border-[#dce9d8] bg-white/90 sm:mx-5 sm:mb-5">
          {[
            "গ্যাস্ট্রিক সমস্যা দূর হবে।",
            "ঘন ঘন টক ঢেকুর বন্ধ হবে।",
            "খাওয়াই রুচি বাড়বে।",
            "বুকে জ্বালাপোড়া বন্ধ হবে।",
            "বদহজম উঠবে না।",
          ].map((benefit, index) => (
            <div key={benefit} className={"flex items-center gap-3 px-3.5 py-3 sm:px-5 sm:py-3.5 " + (index !== 4 ? "border-b border-[#edf2e9]" : "")}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf5e9] text-[#52764d]">
                <Sprout size={16} strokeWidth={2.1} />
              </span>
              <span className="text-[14px] font-semibold leading-6 text-[#344b35] sm:text-[15px]">{benefit}</span>
              <span className="ml-auto text-[#91aa87]"><ShieldCheck size={17} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#dce9d8] py-7">
        <h2 className="flex items-center gap-2 text-xl font-bold"><CircleHelp size={20} className="text-[#477b4d]"/> সাধারণ প্রশ্ন</h2>
        <div className="mt-3 space-y-2">{FAQS.map((faq,i)=><div key={faq.q} className="methi-card overflow-hidden"><button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"><span>{faq.q}</span><ChevronDown size={17} className={"shrink-0 transition "+(openFaq===i?"rotate-180":"")}/></button>{openFaq===i&&<p className="px-4 pb-3 text-xs leading-6 text-[#647a62]">{faq.a}</p>}</div>)}</div>
      </section>

      <section id="methi-order" className="scroll-mt-4 border-t border-[#dce9d8] py-7">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[22px] border border-[#c9ddc3] bg-white shadow-sm">
          <div className="bg-[#24432d] px-5 py-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold text-[#e7f1e1]"><ShoppingBag size={15}/> অর্ডার ফর্ম</div><h2 className="mt-1 text-2xl font-bold">অর্ডার কনফার্ম করুন</h2><p className="mt-1 text-xs text-[#e7f1e1]">১ ফাইল + ১ ফাইল ফ্রি — ৳৫৯৯</p></div>
          <form id="methi-checkout-form" onSubmit={submit} className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between rounded-xl bg-[#f3f8ef] p-3"><div><div className="text-sm font-bold">মেথি মিক্স ১ + ১ ফ্রি</div><div className="text-xs text-[#647a62]">সর্বমোট ৳৫৯৯ × পরিমাণ</div></div><div className="flex items-center gap-3"><button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">−</button><span className="min-w-4 text-center text-sm font-bold">{quantity}</span><button type="button" onClick={()=>setQuantity(q=>Math.min(10,q+1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">+</button></div></div>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="আপনার নাম *" className="w-full rounded-xl border border-[#c9ddc3] px-4 py-3 text-sm outline-none focus:border-[#477b4d]"/>
            <input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="মোবাইল নম্বর *" inputMode="tel" className="w-full rounded-xl border border-[#c9ddc3] px-4 py-3 text-sm outline-none focus:border-[#477b4d]"/>
            <textarea required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="সম্পূর্ণ ঠিকানা *" rows={2} className="w-full resize-y rounded-xl border border-[#c9ddc3] px-4 py-3 text-sm outline-none focus:border-[#477b4d]"/>
            <div className="rounded-xl bg-[#f3f8ef] p-3 text-sm"><div className="flex justify-between"><span>পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div><div className="mt-1 flex justify-between"><span>ডেলিভারি চার্জ</span><b className="text-emerald-700">ফ্রি</b></div><div className="mt-2 flex justify-between border-t border-[#c9ddc3] pt-2 font-bold"><span>সর্বমোট</span><span className="text-[#477b4d]">{taka(total)}</span></div></div>
            <button type="submit" disabled={submitting||!chosen||chosen.price<=0} className="w-full rounded-xl bg-[#477b4d] px-5 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{submitting?"অর্ডার প্রসেস হচ্ছে...":"অর্ডার কনফার্ম করুন"} <ArrowRight className="ml-1 inline" size={16}/></button>
            <p className="text-center text-[10px] text-[#647a62]">অর্ডারটি আমাদের নিয়মিত Orders সেকশনে যুক্ত হবে।</p>
          </form>
        </div>
      </section>
    </main>

    <footer className="border-t border-[#dce9d8] bg-white px-4 py-5 text-center text-[11px] text-[#647a62]"><div className="font-bold text-[#24432d]">মেথি মিক্স পাউডার</div><p className="mt-1">এটি খাদ্যপণ্য; চিকিৎসা বা ওষুধের বিকল্প নয়।</p></footer>
    {!isCheckoutVisible && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c9ddc3] bg-white/95 px-3 py-2.5 shadow-[0_-8px_30px_#24432d18] backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-[#647a62]">বিশেষ অফার • সারা দেশে ডেলিভারি ফ্রি</div><div className="text-sm font-bold leading-5 text-[#24432d]">১ ফাইল কিনুন, ১ ফাইল ফ্রি পান</div><div className="text-xs font-bold text-[#477b4d]">২ ফাইল মাত্র ৳৫৯৯</div></div><button onClick={scrollOrder} className="shrink-0 rounded-xl bg-[#24432d] px-4 py-3 text-sm font-bold text-white shadow-md">এখনই অর্ডার <ArrowRight className="ml-1 inline" size={14}/></button></div></div>}
  </div>;
}
