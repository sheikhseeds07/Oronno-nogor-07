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
import { useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, ChevronDown, CircleHelp, Leaf, PackageCheck,
  ShieldCheck, ShoppingBag, Sprout, CircleDot, Wheat, Flower2, Droplet,
  Flame, Nut, Cherry, Citrus, TreePine, Soup, CookingPot, Sun, Circle,
  Sparkles, Truck,
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
  { q: "মেথি মিক্সে কী কী উপাদান আছে?", a: "নিচে ১৭টি উপাদানের তালিকা দেওয়া হয়েছে। প্যাকেটের গায়ের উপাদান তালিকার সঙ্গেও মিলিয়ে নিন।" },
  { q: "কীভাবে ব্যবহার করব?", a: "প্যাকেটের গায়ে দেওয়া নির্দেশনা অনুসরণ করুন। উপযুক্ততা বা পরিমাণ নিয়ে সন্দেহ থাকলে চিকিৎসক বা পুষ্টিবিদের পরামর্শ নিন।" },
  { q: "এটি কি গ্যাস বা বদহজমের ওষুধ?", a: "না। এটি খাদ্যপণ্য, কোনো রোগের চিকিৎসা বা ওষুধের বিকল্প নয়। সমস্যা দীর্ঘস্থায়ী হলে চিকিৎসকের পরামর্শ নিন।" },
];

export function MethiMixLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeLandingOrder);
  const [quantity, setQuantity] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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

  if (isLoading) return <div className="min-h-screen bg-[#f7f5ef] animate-pulse" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-[#f7f5ef] p-6 text-center"><div><h1 className="text-xl font-black">মেথি মিক্স পেজটি পাওয়া যায়নি</h1><p className="mt-2 text-sm text-slate-600">Admin থেকে পেজটি Publish করুন।</p></div></div>;

  return <div className="methi-mix-page min-h-screen overflow-hidden bg-[#f7f6f0] pb-20 text-[#20382d]">
    <FacebookPixel eager />
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700;800&display=swap');
      .methi-mix-page{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif}
      .methi-mix-page button,.methi-mix-page input,.methi-mix-page textarea{font:inherit}
      .methi-mix-page .methi-card{border:1px solid #e8e4d8;background:#fff;border-radius:18px}
      @media(prefers-reduced-motion:no-preference){.methi-mix-page .methi-card{transition:transform .2s ease,box-shadow .2s ease}.methi-mix-page .methi-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px #20382d12}}
    `}</style>
    <div className="bg-[#20382d] px-3 py-1.5 text-center text-xs font-bold text-[#f2dfb7]">১ + ১ ফ্রি <span className="mx-1 opacity-50">•</span> ৳৫৯৯ <span className="mx-1 opacity-50">•</span> সারা দেশে ডেলিভারি ফ্রি</div>
    <header className="border-b border-[#e8e4d8] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#20382d] text-[#f2dfb7]"><Leaf size={19}/></span><div className="text-lg font-bold leading-none">মেথি মিক্স</div></div>
        <button onClick={scrollOrder} className="rounded-full bg-[#bd8b45] px-4 py-2 text-xs font-bold text-white">অর্ডার করুন <ArrowRight className="ml-1 inline" size={13}/></button>
      </div>
    </header>

    <main className="mx-auto max-w-5xl px-4">
      <section className="grid items-center gap-5 py-7 sm:grid-cols-2 sm:py-10">
        <div className="order-2 sm:order-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#e9eee5] px-3 py-1 text-xs font-bold text-[#456247]"><Sparkles size={13}/> ১৭ উপাদানের ব্লেন্ড</div>
          <h1 className="text-3xl font-bold leading-[1.25] sm:text-4xl">{page.hero_title || "১৭ উপাদানের মেথি মিক্স পাউডার"}</h1>
          <p className="mt-2 text-sm leading-6 text-[#69766a]">{page.hero_subtitle || "পরিচিত বীজ, মসলা ও উদ্ভিজ্জ উপাদানের বিশেষ মিশ্রণ।"}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div><div className="text-[11px] text-[#788476]">১ প্যাকেট + ১ প্যাকেট ফ্রি</div><div className="text-3xl font-bold text-[#a87534]">৳৫৯৯</div></div>
            <button onClick={scrollOrder} className="rounded-xl bg-[#20382d] px-5 py-3 text-sm font-bold text-white shadow-sm">অর্ডার করুন <ArrowRight className="ml-1 inline" size={15}/></button>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#647261]"><span className="inline-flex items-center gap-1"><Truck size={14}/> ফ্রি ডেলিভারি</span><span className="inline-flex items-center gap-1"><ShieldCheck size={14}/> ক্যাশ অন ডেলিভারি</span></div>
          <p className="mt-2 text-[10px] text-[#879184]">এটি খাদ্যপণ্য, ওষুধ বা চিকিৎসার বিকল্প নয়।</p>
        </div>
        <div className="order-1 sm:order-2">
          <div className="relative mx-auto max-w-[370px] overflow-hidden rounded-[26px] border border-[#e5dfd1] bg-[#eee9dc] p-2 shadow-sm">
            {heroImage ? <SafeImage src={toImg(heroImage,{w:760,q:86})} alt={page.title || "মেথি মিক্স"} className="aspect-square w-full rounded-[20px] object-cover"/> :
              <div className="grid aspect-square place-items-center rounded-[20px] bg-gradient-to-br from-[#e7e8d8] to-[#d8c7a6] text-[#52634b]"><div className="text-center"><Sprout size={58} className="mx-auto mb-2"/><div className="text-lg font-bold">মেথি মিক্স</div><div className="text-xs">১ প্যাকেট + ১ প্যাকেট ফ্রি</div></div></div>}
            <div className="absolute bottom-4 right-4 rounded-xl bg-[#20382d] px-3 py-2 text-sm font-bold text-[#f2dfb7] shadow">৳৫৯৯ • ডেলিভারি ফ্রি</div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e8e4d8] py-7">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold sm:text-2xl">১৭টি উপাদান</h2><p className="mt-1 text-xs text-[#788476]">প্রতিটি উপাদানের পরিচিত আইকনসহ তালিকা</p></div><span className="rounded-full bg-[#e9eee5] px-3 py-1 text-xs font-bold text-[#456247]">১৭ ITEMS</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {ingredients.map((item,i)=>{const Icon=INGREDIENT_ICONS[i%INGREDIENT_ICONS.length];return <div key={item.name+i} className="methi-card flex min-h-[66px] items-center gap-2.5 px-3 py-2.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf1e8] text-[#58704e]"><Icon size={21} strokeWidth={1.8}/></span><div className="min-w-0"><div className="text-sm font-semibold leading-5">{item.name}</div>{item.qty&&<div className="text-[10px] text-[#8a9385]">{item.qty}</div>}</div></div>})}
        </div>
      </section>

      <section className="border-t border-[#e8e4d8] py-7">
        <div className="grid grid-cols-3 gap-2.5">
          <div className="methi-card p-3 text-center"><Truck size={20} className="mx-auto text-[#a87534]"/><div className="mt-1 text-xs font-bold">ডেলিভারি ফ্রি</div></div>
          <div className="methi-card p-3 text-center"><PackageCheck size={20} className="mx-auto text-[#a87534]"/><div className="mt-1 text-xs font-bold">১ + ১ প্যাক</div></div>
          <div className="methi-card p-3 text-center"><ShieldCheck size={20} className="mx-auto text-[#a87534]"/><div className="mt-1 text-xs font-bold">সহজ অর্ডার</div></div>
        </div>
      </section>

      <section className="border-t border-[#e8e4d8] py-7">
        <h2 className="flex items-center gap-2 text-xl font-bold"><CircleHelp size={20} className="text-[#a87534]"/> সাধারণ প্রশ্ন</h2>
        <div className="mt-3 space-y-2">{FAQS.map((faq,i)=><div key={faq.q} className="methi-card overflow-hidden"><button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"><span>{faq.q}</span><ChevronDown size={17} className={"shrink-0 transition "+(openFaq===i?"rotate-180":"")}/></button>{openFaq===i&&<p className="px-4 pb-3 text-xs leading-6 text-[#6d786b]">{faq.a}</p>}</div>)}</div>
      </section>

      <section id="methi-order" className="scroll-mt-4 border-t border-[#e8e4d8] py-7">
        <div className="mx-auto max-w-xl overflow-hidden rounded-[22px] border border-[#e4dfd2] bg-white shadow-sm">
          <div className="bg-[#20382d] px-5 py-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold text-[#e8d5ad]"><ShoppingBag size={15}/> অর্ডার ফর্ম</div><h2 className="mt-1 text-2xl font-bold">অর্ডার কনফার্ম করুন</h2><p className="mt-1 text-xs text-[#d4dfd1]">১ প্যাকেট + ১ প্যাকেট ফ্রি — ৳৫৯৯</p></div>
          <form onSubmit={submit} className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between rounded-xl bg-[#f3f3ed] p-3"><div><div className="text-sm font-bold">মেথি মিক্স ১ + ১ ফ্রি</div><div className="text-xs text-[#788476]">সর্বমোট ৳৫৯৯ × পরিমাণ</div></div><div className="flex items-center gap-3"><button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">−</button><span className="min-w-4 text-center text-sm font-bold">{quantity}</span><button type="button" onClick={()=>setQuantity(q=>Math.min(10,q+1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold">+</button></div></div>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="আপনার নাম *" className="w-full rounded-xl border border-[#deded4] px-4 py-3 text-sm outline-none focus:border-[#a87534]"/>
            <input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="মোবাইল নম্বর *" inputMode="tel" className="w-full rounded-xl border border-[#deded4] px-4 py-3 text-sm outline-none focus:border-[#a87534]"/>
            <textarea required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="সম্পূর্ণ ঠিকানা *" rows={2} className="w-full resize-y rounded-xl border border-[#deded4] px-4 py-3 text-sm outline-none focus:border-[#a87534]"/>
            <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="অতিরিক্ত নির্দেশনা (ঐচ্ছিক)" rows={1} className="w-full resize-y rounded-xl border border-[#deded4] px-4 py-3 text-sm outline-none focus:border-[#a87534]"/>
            <div className="rounded-xl bg-[#f3f3ed] p-3 text-sm"><div className="flex justify-between"><span>পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div><div className="mt-1 flex justify-between"><span>ডেলিভারি চার্জ</span><b className="text-emerald-700">ফ্রি</b></div><div className="mt-2 flex justify-between border-t border-[#deded4] pt-2 font-bold"><span>সর্বমোট</span><span className="text-[#a87534]">{taka(total)}</span></div></div>
            <button type="submit" disabled={submitting||!chosen||chosen.price<=0} className="w-full rounded-xl bg-[#bd8b45] px-5 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{submitting?"অর্ডার প্রসেস হচ্ছে...":"অর্ডার কনফার্ম করুন"} <ArrowRight className="ml-1 inline" size={16}/></button>
            <p className="text-center text-[10px] text-[#8a9385]">অর্ডারটি আমাদের নিয়মিত Orders সেকশনে যুক্ত হবে।</p>
          </form>
        </div>
      </section>
    </main>

    <footer className="border-t border-[#e8e4d8] bg-white px-4 py-5 text-center text-[11px] text-[#788476]"><div className="font-bold text-[#20382d]">মেথি মিক্স পাউডার</div><p className="mt-1">এটি খাদ্যপণ্য; চিকিৎসা বা ওষুধের বিকল্প নয়।</p></footer>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e1ddcf] bg-white/95 p-2 shadow-lg backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] text-[#788476]">১ + ১ ফ্রি</div><div className="text-base font-bold text-[#20382d]">৳৫৯৯</div></div><button onClick={scrollOrder} className="rounded-xl bg-[#20382d] px-5 py-3 text-sm font-bold text-white">অর্ডার করুন <ArrowRight className="ml-1 inline" size={14}/></button></div></div>
  </div>;
}
