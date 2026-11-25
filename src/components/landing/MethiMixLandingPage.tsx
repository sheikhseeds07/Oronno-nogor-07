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
  ArrowRight, ChevronDown, CircleHelp, Leaf, PackageCheck,
  ShieldCheck, ShoppingBag, Sprout, CircleDot, Wheat, Flower2, Droplet,
  Flame, Nut, Citrus, TreePine, CookingPot, Circle,
  Sparkles, Truck, Waves,
} from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { toast } from "sonner";

type Ingredient = { name: string; qty?: string; image?: string };
type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; delivery_fee?: number | null };
type Package = { id: string; name: string; price: number; oldPrice: number | null; image: string; deliveryFee: number };

const DEFAULT_INGREDIENTS = [
  "মেথি দানা","কালোজিরা","জিরা","মৌরি","সরিষা দানা","ধনিয়া","তিসি বীজ",
  "চিয়া সিড","তোকমা দানা","কালো তিল","সাদা তিল","ইসবগুলের ভুসি",
  "আমলকী গুঁড়া","দারুচিনি","এলাচ","লবঙ্গ","শুকনো আদা গুঁড়া",
];
const INGREDIENT_ICONS = [
  Sprout, CircleDot, Wheat, Flower2, Droplet, Leaf, Nut, CircleDot, Droplet,
  Circle, Circle, Waves, Citrus, TreePine, Sparkles, Flame, CookingPot,
];
const FAQS = [
  { q: "মেথি মিক্স কী এবং এর কাজ কী?", a: "মেথি মিক্স বিভিন্ন ভেষজ ও মসলাজাতীয় উপাদানের সমন্বয়ে তৈরি একটি খাদ্যপণ্য। এটি কোনো নির্দিষ্ট রোগ সারায় বা গ্যাস্ট্রিকের চিকিৎসা করে—এমন প্রমাণিত দাবি করা যায় না। পেটের অস্বস্তি বা হজমের সমস্যা নিয়মিত হলে চিকিৎসকের পরামর্শ নিন।" },
  { q: "এতে কী কী উপাদান রয়েছে?", a: "প্রস্তুতকারকের দেওয়া তথ্য অনুযায়ী এতে আমলকী, হরিতকি, বহেড়া, সোনাপাতা, জোয়ান, ধনিয়া, মৌরি ও মেথি চূর্ণসহ প্রায় ১৫টি উপাদান রয়েছে। সম্পূর্ণ ও নির্ভুল তালিকার জন্য প্যাকেটের লেবেল দেখুন।" },
  { q: "এটি কি ওষুধ? জেনে রাখুন", a: "এটি খাদ্য সম্পূরক, ওষুধ নয়। গর্ভবতী, স্তন্যদানকারী মা, শিশু বা নিয়মিত ওষুধ সেবনকারী হলে খাওয়ার আগে চিকিৎসকের পরামর্শ নিন।" },
];

export function MethiMixLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeLandingOrder);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById("methi-order");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setIsCheckoutVisible(entry.isIntersecting), { threshold: 0.08 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const { data: page, isLoading } = useQuery({
    queryKey: ["landing-methi-mix", slug],
    staleTime: 10_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => (await supabase.from("landing_pages").select(LANDING_PAGES_COLUMNS + ", products(" + LANDING_PRODUCT_COLUMNS + ")").eq("slug", slug).eq("is_published", true).maybeSingle()).data,
  });
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
  const rawSteps = (page?.planting_steps ?? {}) as { seed_table?: Ingredient[]; methi_initialized?: boolean };
  const ingredients = rawSteps.methi_initialized && rawSteps.seed_table?.length
    ? rawSteps.seed_table.filter((x) => x.name?.trim())
    : DEFAULT_INGREDIENTS.map((name) => ({ name }));
  const scrollOrder = () => document.getElementById("methi-order")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return toast.error("নাম, ফোন নম্বর ও ঠিকানা পূরণ করুন");
    if (!chosen || !chosen.id || chosen.price <= 0) return toast.error("পণ্যের প্যাকেজ Admin থেকে যুক্ত করতে হবে");
    setSubmitting(true);
    try {
      const items = [{ id: chosen.id, name: "১ প্যাকেট + ১ প্যাকেট ফ্রি", price: 599, quantity }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: {
        landing_slug: slug, customer_name: form.name.trim(),
        customer_phone: form.phone.replace(/[\\s-]/g, ""),
        customer_address: form.address.trim(), delivery_fee: 0, items,
        notes: form.note || null,
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

  if (isLoading) return <div className="min-h-screen bg-[#ffffff] animate-pulse" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-[#ffffff] p-6 text-center"><div><h1 className="text-xl font-black">মেথি মিক্স পেজটি পাওয়া যায়নি</h1><p className="mt-2 text-sm text-slate-600">Admin থেকে পেজটি Publish করুন।</p></div></div>;

  return <div className="methi-mix-page min-h-screen overflow-hidden bg-[#ffffff] pb-20 text-[#3b1720]">
    <FacebookPixel eager />
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap');
      .methi-mix-page{font-family:'Hind Siliguri','Anek Bangla',sans-serif}.methi-mix-page .methi-hero-title{font-family:'Anek Bangla','Hind Siliguri',sans-serif;font-weight:800;letter-spacing:-.025em}
      .methi-mix-page button,.methi-mix-page input,.methi-mix-page textarea{font:inherit}
      .methi-mix-page .methi-card{border:1px solid #fee2e2;background:#fff;border-radius:18px}
      @media(prefers-reduced-motion:no-preference){.methi-mix-page .methi-card{transition:transform .2s ease,box-shadow .2s ease}.methi-mix-page .methi-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px #3b172012}}
    `}</style>
    <main className="mx-auto max-w-4xl px-4">
      <section className="py-5 sm:py-8">
        <h1 className="methi-hero-title mb-4 text-center text-3xl font-extrabold leading-[1.2] text-[#3b1720] sm:text-4xl">
          মেথি মিক্স পাউডার
          <span className="mt-2 block text-xl font-extrabold text-[#c62828] sm:text-2xl">১ প্যাকেটের সাথে ১ প্যাকেট ফ্রি</span>
        </h1>
        <div className="relative mx-auto max-w-[440px] overflow-hidden rounded-[26px] border border-[#fecaca] bg-[#fff7f7] p-2 shadow-[0_14px_40px_#3b172014]">
          {heroImage ? <SafeImage src={toImg(heroImage,{w:880,q:88})} alt={page.title || "মেথি মিক্স পাউডার"} className="aspect-square w-full rounded-[20px] object-cover"/> :
            <div className="grid aspect-square place-items-center rounded-[20px] bg-gradient-to-br from-[#ffe4e6] to-[#fecdd3] text-[#c62828]"><div className="text-center"><Sprout size={58} className="mx-auto mb-2"/><div className="text-lg font-bold">মেথি মিক্স</div></div></div>}
        </div>
      </section>


      <section className="border-t border-[#fee2e2] py-6">
        <div className="text-center"><span className="text-xs font-bold tracking-wide text-[#c62828]">DIGESTIVE WELLNESS</span><h2 className="mt-1 text-xl font-extrabold sm:text-2xl">হজমের অস্বস্তি সম্পর্কে জানুন</h2><p className="mt-1 text-xs text-[#806b70]">পেটের অস্বস্তির লক্ষণগুলো অবহেলা করবেন না</p></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#fee2e2] bg-white">
          {["পেটে গ্যাস ও অস্বস্তি","পেট, বুক বা পিঠে ব্যথা","টক ঢেকুর ও বমি বমি ভাব","ক্ষুধামন্দা ও খাবারে অরুচি","বুকে জ্বালাপোড়া","বদহজম ও কোষ্ঠকাঠিন্য","দুর্বলতা"].map((item,i)=><div key={item} className="flex items-center gap-3 border-b border-[#fff0f0] px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff1f2] text-xs font-bold text-[#c62828]">{i+1}</span><span className="text-sm font-semibold text-[#3b1720]">{item}</span></div>)}
        </div>
        <p className="mt-3 rounded-xl bg-[#fff7f7] p-3 text-xs leading-5 text-[#80565d]">এসব উপসর্গের কারণ একাধিক হতে পারে। মেথি মিক্স এসব সমস্যা দূর করে বা গ্যাস্ট্রিকের চিকিৎসা করে—এমন নিশ্চয়তা দেওয়া যায় না। ব্যথা, বুকজ্বালা বা হজমের সমস্যা চলতে থাকলে চিকিৎসকের পরামর্শ নিন।</p>
      </section>

      <section className="border-t border-[#fee2e2] py-6">
        <div className="text-center"><span className="text-xs font-bold text-[#c62828]">INGREDIENTS</span><h2 className="mt-1 text-xl font-extrabold sm:text-2xl">মেথি মিক্সের উপাদান</h2><p className="mt-1 text-xs text-[#806b70]">প্রস্তুতকারকের দেওয়া উপাদান পরিচিতি</p></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#fee2e2] bg-white">
          <div className="grid grid-cols-1 divide-y divide-[#fff0f0] sm:grid-cols-2 sm:divide-y-0">
            {ingredients.map((item,i)=><div key={item.name} className="flex items-center gap-3 border-b border-[#fff0f0] px-4 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff1f2] text-[#c62828]"><Leaf size={18}/></span><span className="text-sm font-semibold text-[#3b1720]">{item.name}</span></div>)}
          </div>
          <div className="border-t border-[#fff0f0] bg-[#fffafa] px-4 py-3 text-xs leading-5 text-[#806b70]">এতে উল্লেখিত উপাদানগুলোর পাশাপাশি প্রস্তুতকারকের তথ্য অনুযায়ী প্রায় ১৫টি উপাদান রয়েছে। সম্পূর্ণ উপাদান তালিকা প্যাকেটের লেবেল থেকে যাচাই করুন।</div>
        </div>
      </section>

      <section className="border-t border-[#fee2e2] py-6">
        <div className="text-center"><span className="text-xs font-bold text-[#c62828]">HOW TO USE</span><h2 className="mt-1 text-xl font-extrabold sm:text-2xl">খাওয়ার নিয়ম</h2></div>
        <div className="methi-card mt-4 flex items-start gap-3 border-[#fee2e2] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff1f2] text-[#c62828]"><CookingPot size={22}/></span>
          <div><h3 className="text-sm font-bold text-[#3b1720]">প্রস্তুতকারকের দেওয়া ব্যবহারবিধি</h3><p className="mt-1 text-sm leading-6 text-[#59464a]">প্রতিদিন রাতে খাবারের পর এক চামচ পাউডার আধা গ্লাস স্বাভাবিক পানিতে ভালোভাবে গুলিয়ে পান করার নির্দেশনা দেওয়া হয়েছে।</p><p className="mt-2 text-xs leading-5 text-[#806b70]">ব্যবহারের আগে প্যাকেটের লেবেলে থাকা নির্দেশনা ও পরিমাণ মিলিয়ে নিন। সোনাপাতা/সেনা-জাতীয় উপাদান থাকলে নিয়মিত ব্যবহারের আগে চিকিৎসক বা ফার্মাসিস্টের পরামর্শ নিন।</p></div>
        </div>
      </section>

      <section className="border-t border-[#fee2e2] py-6">
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-4">
          <h2 className="text-base font-extrabold text-[#a51d2d]">জেনে রাখুন</h2>
          <p className="mt-2 text-sm leading-6 text-[#59464a]">এটি খাদ্য সম্পূরক, ওষুধ নয়। গর্ভবতী, স্তন্যদানকারী মা, শিশু বা নিয়মিত ওষুধ সেবনকারী হলে খাওয়ার আগে চিকিৎসকের পরামর্শ নিন।</p>
        </div>
      </section>
      <section className="border-t border-[#fee2e2] py-7">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="methi-card p-3 text-center"><Truck size={20} className="mx-auto text-[#c62828]"/><div className="mt-1 text-xs font-bold">ডেলিভারি ফ্রি</div></div>
          <div className="methi-card p-3 text-center"><PackageCheck size={20} className="mx-auto text-[#c62828]"/><div className="mt-1 text-xs font-bold">১ + ১ প্যাক</div></div>
          <div className="methi-card p-3 text-center"><ShieldCheck size={20} className="mx-auto text-[#c62828]"/><div className="mt-1 text-xs font-bold">সহজ অর্ডার</div></div>
        </div>
      </section>

      <section className="border-t border-[#fee2e2] py-7">
        <h2 className="flex items-center gap-2 text-xl font-bold"><CircleHelp size={20} className="text-[#c62828]"/> সাধারণ প্রশ্ন</h2>
        <div className="mt-3 space-y-2">{FAQS.map((faq,i)=><div key={faq.q} className="methi-card overflow-hidden"><button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"><span>{faq.q}</span><ChevronDown size={17} className={"shrink-0 transition "+(openFaq===i?"rotate-180":"")}/></button>{openFaq===i&&<p className="px-4 pb-3 text-xs leading-6 text-[#806b70]">{faq.a}</p>}</div>)}</div>
      </section>

      <section id="methi-order" className="scroll-mt-4 border-t border-[#fee2e2] py-7">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[22px] border border-[#fecaca] bg-white shadow-sm">
          <div className="bg-[#3b1720] px-5 py-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold text-[#ffe4e6]"><ShoppingBag size={15}/> অর্ডার ফর্ম</div><h2 className="mt-1 text-2xl font-bold">অর্ডার কনফার্ম করুন</h2><p className="mt-1 text-xs text-[#ffe4e6]">১ প্যাকেট + ১ প্যাকেট ফ্রি — ৳৫৯৯</p></div>
          <form onSubmit={submit} className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between rounded-xl bg-[#fff7f7] p-3"><div><div className="text-sm font-bold">মেথি মিক্স ১ + ১ ফ্রি</div><div className="text-xs text-[#806b70]">সর্বমোট ৳৫৯৯ × পরিমাণ</div></div><div className="flex items-center gap-3"><button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">−</button><span className="min-w-4 text-center text-sm font-bold">{quantity}</span><button type="button" onClick={()=>setQuantity(q=>Math.min(10,q+1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">+</button></div></div>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="আপনার নাম *" className="w-full rounded-xl border border-[#fecaca] px-4 py-3 text-sm outline-none focus:border-[#c62828]"/>
            <input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="মোবাইল নম্বর *" inputMode="tel" className="w-full rounded-xl border border-[#fecaca] px-4 py-3 text-sm outline-none focus:border-[#c62828]"/>
            <textarea required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="সম্পূর্ণ ঠিকানা *" rows={2} className="w-full resize-y rounded-xl border border-[#fecaca] px-4 py-3 text-sm outline-none focus:border-[#c62828]"/>
            <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="অতিরিক্ত নির্দেশনা (ঐচ্ছিক)" rows={1} className="w-full resize-y rounded-xl border border-[#fecaca] px-4 py-3 text-sm outline-none focus:border-[#c62828]"/>
            <div className="rounded-xl bg-[#fff7f7] p-3 text-sm"><div className="flex justify-between"><span>পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div><div className="mt-1 flex justify-between"><span>ডেলিভারি চার্জ</span><b className="text-emerald-700">ফ্রি</b></div><div className="mt-2 flex justify-between border-t border-[#fecaca] pt-2 font-bold"><span>সর্বমোট</span><span className="text-[#c62828]">{taka(total)}</span></div></div>
            <button type="submit" disabled={submitting||!chosen||chosen.price<=0} className="w-full rounded-xl bg-[#c62828] px-5 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{submitting?"অর্ডার প্রসেস হচ্ছে...":"অর্ডার কনফার্ম করুন"} <ArrowRight className="ml-1 inline" size={16}/></button>
            <p className="text-center text-[10px] text-[#806b70]">অর্ডারটি আমাদের নিয়মিত Orders সেকশনে যুক্ত হবে।</p>
          </form>
        </div>
      </section>
    </main>

    <footer className="border-t border-[#fee2e2] bg-white px-4 py-5 text-center text-[11px] text-[#806b70]"><div className="font-bold text-[#3b1720]">মেথি মিক্স পাউডার</div><p className="mt-1">এটি খাদ্যপণ্য; চিকিৎসা বা ওষুধের বিকল্প নয়।</p></footer>
    {!isCheckoutVisible && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#fecaca] bg-white/95 px-3 py-2.5 shadow-[0_-8px_30px_#3b172018] backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-[#806b70]">বিশেষ অফার • সারা দেশে ডেলিভারি ফ্রি</div><div className="text-sm font-bold leading-5 text-[#3b1720]">১ প্যাকেট কিনুন, ১ প্যাকেট ফ্রি পান</div><div className="text-xs font-bold text-[#c62828]">২ প্যাকেট মাত্র ৳৫৯৯</div></div><button onClick={scrollOrder} className="shrink-0 rounded-xl bg-[#3b1720] px-4 py-3 text-sm font-bold text-white shadow-md">এখনই অর্ডার <ArrowRight className="ml-1 inline" size={14}/></button></div></div>}
  </div>;
}
