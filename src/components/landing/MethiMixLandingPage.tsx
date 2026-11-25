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
import { ArrowRight, CheckCircle2, ChevronDown, CircleHelp, Leaf, PackageCheck, ShieldCheck, ShoppingBag, Sparkles, Truck } from "lucide-react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/fbq";
import { toast } from "sonner";

type Ingredient = { name: string; qty?: string; image?: string };
type Product = { id: string; name: string; price: number; sale_price: number | null; images: string[] | null };
type Addon = { product_id?: string; name: string; price: number; image?: string; old_price?: number; delivery_fee?: number | null };
type Package = { id: string; name: string; price: number; oldPrice: number | null; image: string; deliveryFee: number };
const DEFAULT_INGREDIENTS = ["মেথি দানা","কালোজিরা","জিরা","মৌরি","সরিষা দানা","ধনিয়া","তিসি বীজ","চিয়া সিড","তোকমা দানা","কালো তিল","সাদা তিল","ইসবগুলের ভুসি","আমলকী গুঁড়া","দারুচিনি","এলাচ","লবঙ্গ","শুকনো আদা গুঁড়া"];
const FAQS = [
  { q: "মেথি মিক্সে কী কী উপাদান রয়েছে?", a: "পণ্যের প্যাকেটে উল্লেখিত ১৭টি উপাদানের তালিকা এই পেজে দেওয়া হয়েছে। প্রতিটি উপাদানের ছবি Admin থেকে আপলোড করা যাবে।" },
  { q: "কীভাবে ব্যবহার করব?", a: "প্যাকেটের গায়ে দেওয়া নির্দেশনা অনুসরণ করুন। আপনার জন্য উপযুক্ততা বা পরিমাণ নিয়ে সন্দেহ থাকলে চিকিৎসক বা পুষ্টিবিদের পরামর্শ নিন।" },
  { q: "এটি কি গ্যাস বা বদহজমের চিকিৎসা?", a: "এটি একটি খাদ্যপণ্য, কোনো ওষুধ বা চিকিৎসার বিকল্প নয়। গ্যাস, বদহজম বা টক ঢেকুর দীর্ঘস্থায়ী হলে চিকিৎসকের পরামর্শ নিন।" },
  { q: "অর্ডার কীভাবে নিশ্চিত হবে?", a: "নাম, মোবাইল নম্বর ও সম্পূর্ণ ঠিকানা দিয়ে অর্ডার কনফার্ম করুন। অর্ডারটি আমাদের নিয়মিত অর্ডার সেকশনে যুক্ত হবে।" },
];

export function MethiMixLandingPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeLandingOrder);
  const [selected, setSelected] = useState(0);
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
  // Fixed launch offer: one pack + one free pack, with nationwide free delivery.
  const basePrice = 599;
  const delivery = 0;
  const packages = useMemo<Package[]>(() => {
    if (product) return [{
      id: product.id,
      name: product.name,
      price: basePrice,
      oldPrice: null,
      image: heroImage,
      deliveryFee: 0,
    }];
    return addons.slice(0, 1).map((addon, index) => ({
      id: addon.product_id || "addon-" + index,
      name: addon.name,
      price: Number(addon.price),
      oldPrice: null,
      image: addon.image || heroImage,
      deliveryFee: 0,
    }));
  }, [product, addons, basePrice, heroImage]);
  const chosen = packages[selected] || packages[0];
  const subtotal = (chosen?.price || 0) * quantity;
  const shipping = chosen?.deliveryFee ?? delivery;
  const total = subtotal + shipping;
  const rawSteps = (page?.planting_steps ?? {}) as { seed_table?: Ingredient[]; gallery_images?: string[]; methi_initialized?: boolean; methi_usage_text?: string; methi_story_text?: string };
  const ingredients = rawSteps.methi_initialized && rawSteps.seed_table?.length ? rawSteps.seed_table.filter((x) => x.name?.trim()) : DEFAULT_INGREDIENTS.map((name) => ({ name }));
  const gallery = (rawSteps.gallery_images || []).filter(Boolean);
  const features = (page?.features || []).filter((x: any) => x?.title);
  const why = (page?.why_choose_us || []).filter((x: any) => x?.title);
  const reviews = (page?.reviews || []).filter((x: any) => x?.name && x?.text);
  const scrollOrder = () => document.getElementById("methi-order")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) return toast.error("নাম, ফোন নম্বর ও ঠিকানা পূরণ করুন");
    if (!chosen || !chosen.id || chosen.price <= 0) return toast.error("পণ্যের দাম ও প্যাকেজ Admin থেকে সেট করতে হবে");
    setSubmitting(true);
    try {
      const items = [{ id: chosen.id, name: chosen.name, price: chosen.price, quantity }];
      trackInitiateCheckout(items, total);
      const order = await runPlaceOrder({ data: { landing_slug: slug, customer_name: form.name.trim(), customer_phone: form.phone.replace(/[\\s-]/g, ""), customer_address: form.address.trim(), delivery_fee: shipping, items, notes: form.note || null, source_url: typeof window !== "undefined" ? window.location.href : null, ...getFbContext() } });
      trackPurchase(items, total, order.id);
      toast.success("আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (error) {
      notifyOrderError(error);
      setSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#f6f3e9] animate-pulse" />;
  if (!page) return <div className="min-h-screen grid place-items-center bg-[#f6f3e9] p-6 text-center"><div><h1 className="text-2xl font-black">মেথি মিক্স পেজটি এখনো প্রকাশিত হয়নি</h1><p className="mt-2 text-sm text-slate-600">Admin থেকে পেজটি Publish করুন।</p></div></div>;

  return <div className="methi-mix-page min-h-screen overflow-hidden bg-[#f7f5ed] text-[#20382d]">
    <FacebookPixel eager />
    <style>{".methi-mix-page{font-family:'Hind Siliguri','Noto Sans Bengali',sans-serif}.methi-grain{background-image:radial-gradient(rgba(32,56,45,.075) .7px,transparent .7px);background-size:14px 14px}.methi-float{animation:methiFloat 6s ease-in-out infinite}.methi-reveal{animation:methiReveal .7s ease both}@keyframes methiFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-9px) rotate(1deg)}}@keyframes methiReveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.methi-float,.methi-reveal{animation:none}}"}
    </style>
    <div className="bg-[#20382d] px-3 py-2 text-center text-xs sm:text-sm font-bold tracking-wide text-[#f7e9c8]">১ প্যাকেট কিনলে ১ প্যাকেট ফ্রি • মূল্য ৳৫৯৯ • সারা দেশে ডেলিভারি ফ্রি</div>
    <header className="relative z-10 border-b border-[#e7e0d1] bg-[#fbfaf5]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#20382d] text-[#f4dfad]"><Leaf size={21}/></span><div><div className="text-lg font-black leading-none">মেথি মিক্স</div><div className="mt-1 text-[10px] font-semibold tracking-[.18em] text-[#788274]">HERBAL BLEND</div></div></div>
        <button onClick={scrollOrder} className="rounded-full bg-[#c28b3c] px-4 py-2 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5">অর্ডার করুন <ArrowRight className="ml-1 inline" size={14}/></button>
      </div>
    </header>
    <main>
      <section className="relative isolate overflow-hidden bg-[#20382d] text-white">
        <div className="methi-grain absolute inset-0 opacity-40"/><div className="absolute -right-28 -top-24 h-80 w-80 rounded-full bg-[#c28b3c]/20 blur-3xl"/><div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#8ca47b]/20 blur-3xl"/>
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:py-16 md:grid-cols-[1.05fr_.95fr] md:px-8">
          <div className="methi-reveal order-2 md:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e6c98d]/35 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#f2dba8]"><Sparkles size={14}/> ১৭ উপাদানের বিশেষ মিশ্রণ</div>
            <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.2] tracking-tight sm:text-5xl lg:text-6xl">{page.hero_title || "প্রতিদিনের খাদ্যাভ্যাসে যোগ করুন মেথি মিক্স"}</h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-[#e4e9dd] sm:text-lg">{page.hero_subtitle || "পরিচিত ১৭টি বীজ, মসলা ও উদ্ভিজ্জ উপাদানের সমন্বয়ে তৈরি একটি বিশেষ পাউডার ব্লেন্ড।"}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-[#f3e6c9]"><span className="rounded-full bg-white/10 px-3 py-2">১৭টি উপাদান</span><span className="rounded-full bg-white/10 px-3 py-2">উপাদান সম্পর্কে জানুন</span><span className="rounded-full bg-white/10 px-3 py-2">ক্যাশ অন ডেলিভারি</span></div>
            <div className="mt-7 flex flex-wrap items-center gap-4">{chosen && chosen.price > 0 ? <div><div className="text-xs text-[#c8d1c2]">১ প্যাকেট + ১ প্যাকেট ফ্রি</div><div className="text-3xl font-black text-[#f1d39a]">{taka(chosen.price)}</div><div className="text-xs font-bold text-[#f1d39a]">সারা দেশে ডেলিভারি ফ্রি</div></div> : <div className="text-sm font-semibold text-[#f1d39a]">পণ্যটি Admin থেকে যুক্ত করুন</div>}<button onClick={scrollOrder} className="rounded-2xl bg-[#d39b4c] px-6 py-3.5 font-black text-[#20382d] shadow-xl transition hover:-translate-y-1">প্যাকেজ দেখুন <ArrowRight className="ml-1 inline" size={16}/></button></div>
            <p className="mt-4 text-[11px] leading-5 text-[#bdc9b8]">এটি খাদ্যপণ্য; কোনো রোগের চিকিৎসা বা ওষুধের বিকল্প নয়।</p>
          </div>
          <div className="methi-float order-1 md:order-2"><div className="relative mx-auto max-w-[440px] rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-[#f3ead5] to-[#d8c7a6] p-4 shadow-2xl">
            <div className="absolute -left-4 top-12 z-10 grid h-20 w-20 place-items-center rounded-full border border-[#d9c38f] bg-[#fbf7e9] text-center text-[10px] font-black leading-4 text-[#34503a] shadow-xl">17<br/>উপাদান</div>
            {heroImage ? <SafeImage src={toImg(heroImage,{w:900,q:88})} alt={page.title || "মেথি মিক্স পাউডার"} className="aspect-square w-full rounded-[2rem] object-cover"/> : <div className="grid aspect-square place-items-center rounded-[2rem] bg-[#e7ddc6] text-center text-[#52624d]"><div><PackageCheck size={54} className="mx-auto mb-3"/><div className="font-black">আপনার পণ্যের ছবি</div><div className="text-xs">Admin Edit Section থেকে আপলোড করুন</div></div></div>}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#20382d] px-4 py-3 text-xs font-bold text-[#f4e7c8]"><span>মেথি মিক্স পাউডার</span><span>HERBAL BLEND</span></div>
          </div></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center"><div className="text-xs font-black tracking-[.22em] text-[#b17b35]">KNOW WHAT YOU CONSUME</div><h2 className="mt-3 text-3xl font-black sm:text-4xl">এক প্যাকেটে ১৭টি পরিচিত উপাদান</h2><p className="mt-3 text-sm leading-7 text-[#687468]">প্রতিটি উপাদানের নাম ও ছবি দেখে পণ্যের মিশ্রণ সম্পর্কে জেনে নিন।</p></div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{ingredients.map((item,i)=><article key={item.name+i} className="group overflow-hidden rounded-3xl border border-[#e8e1d3] bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="relative overflow-hidden rounded-2xl bg-[#f1eee5]">{item.image ? <SafeImage src={toImg(item.image,{w:420,q:82})} alt={item.name} className="aspect-[1.25] w-full object-cover transition duration-500 group-hover:scale-105"/> : <div className="grid aspect-[1.25] place-items-center text-[#a9a18e]"><Leaf size={30}/><span className="text-[10px]">ছবি আপলোড করুন</span></div>}<span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-[#20382d] text-[10px] font-black text-white">{String(i+1).padStart(2,"0")}</span></div><h3 className="mt-3 text-sm font-black text-[#263d30] sm:text-base">{item.name}</h3>{item.qty&&<p className="mt-1 text-[11px] text-[#879083]">{item.qty}</p>}</article>)}</div>
      </section>
      <section className="bg-[#e9e5d8] px-4 py-12 sm:py-16"><div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2"><div className="relative overflow-hidden rounded-[2rem] bg-[#20382d] p-6 text-white sm:p-9"><div className="text-xs font-black tracking-[.2em] text-[#e2bd7a]">A CLOSER LOOK</div><h2 className="mt-3 text-3xl font-black leading-tight">উপাদান জানুন, সচেতনভাবে বেছে নিন</h2><p className="mt-4 text-sm leading-7 text-[#d9e1d4]">{(rawSteps as any).methi_story_text || "মেথি দানা, বিভিন্ন বীজ, মসলা ও উদ্ভিজ্জ উপাদানের সমন্বয়ে তৈরি এই ব্লেন্ডের উপাদানগুলো এক নজরে দেখে নিন।"}</p><div className="mt-6 flex items-center gap-3 text-sm font-bold text-[#f1d39a]"><CheckCircle2 size={18}/> প্যাকেটের উপাদান তালিকার সঙ্গে মিলিয়ে নিন</div></div><div className="grid grid-cols-2 gap-3">{[["17","তালিকাভুক্ত উপাদান"],["01","বিশেষ ব্লেন্ড"],["সঠিক","প্যাকেটের তথ্য"],["COD","অর্ডার সুবিধা"]].map(([n,t])=><div key={t} className="rounded-3xl border border-[#d8d1c1] bg-[#f8f6ef] p-5"><div className="text-3xl font-black text-[#a87534]">{n}</div><div className="mt-1 text-xs font-bold text-[#637063]">{t}</div></div>)}</div></div></section>
      {gallery.length>0&&<section className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><h2 className="text-center text-2xl font-black">পণ্যের আরও ছবি</h2><div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">{gallery.map((src,i)=><SafeImage key={src+i} src={toImg(src,{w:800,q:84})} alt={"মেথি মিক্স ছবি "+(i+1)} className="w-full rounded-3xl border border-[#e5dfd2] object-cover"/>)}</div></section>}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><div className="grid gap-4 md:grid-cols-3">{[{icon:ShieldCheck,title:"তথ্য দেখে অর্ডার",text:"উপাদান ও প্যাকেজ সম্পর্কে জেনে সিদ্ধান্ত নিন।"},{icon:Truck,title:"সারা দেশে ডেলিভারি",text:"আপনার ঠিকানায় পণ্য পৌঁছে দেওয়ার ব্যবস্থা।"},{icon:PackageCheck,title:"পণ্য হাতে পেয়ে পরিশোধ",text:"Cash on Delivery সুবিধা প্রযোজ্য থাকলে ডেলিভারির সময় মূল্য দিন।"}].map(({icon:Icon,title,text})=><div key={title} className="rounded-3xl border border-[#e8e1d3] bg-white p-5"><Icon className="text-[#a87534]" size={27}/><h3 className="mt-3 font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-[#7b8478]">{text}</p></div>)}</div></section>
      {features.length>0&&<section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6"><h2 className="text-center text-2xl font-black">পণ্যের বৈশিষ্ট্য</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{features.map((f:any,i:number)=><div key={i} className="flex gap-3 rounded-2xl border border-[#e8e1d3] bg-white p-4"><span className="text-xl">{f.icon||"✦"}</span><div><h3 className="font-black">{f.title}</h3>{f.text&&<p className="mt-1 text-sm leading-6 text-[#778174]">{f.text}</p>}</div></div>)}</div></section>}
      {why.length>0&&<section className="bg-[#20382d] px-4 py-12 text-white sm:py-14"><div className="mx-auto max-w-6xl"><h2 className="text-center text-2xl font-black">কেন আমাদের কাছ থেকে অর্ডার করবেন?</h2><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{why.map((w:any,i:number)=><div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl">{w.icon||"✓"}</div><div className="mt-2 font-black">{w.title}</div>{w.text&&<p className="mt-1 text-sm leading-6 text-[#d1dbce]">{w.text}</p>}</div>)}</div></div></section>}
      {reviews.length>0&&<section className="mx-auto max-w-6xl px-4 py-12 sm:px-6"><h2 className="text-center text-2xl font-black">ক্রেতাদের মতামত</h2><div className="mt-6 grid gap-3 md:grid-cols-3">{reviews.map((r:any,i:number)=><article key={i} className="rounded-3xl border border-[#e8e1d3] bg-white p-5"><div className="text-amber-500">{"★".repeat(Math.max(1,Math.min(5,Number(r.rating)||5)))}</div><p className="mt-3 text-sm leading-7 text-[#657064]">“{r.text}”</p><div className="mt-4 text-sm font-black">{r.name}</div></article>)}</div></section>}
      <section className="bg-[#eee8d9] px-4 py-12 sm:py-16"><div className="mx-auto max-w-3xl"><div className="text-center"><CircleHelp className="mx-auto text-[#a87534]" size={30}/><h2 className="mt-2 text-3xl font-black">আপনার মনে যেসব প্রশ্ন আসতে পারে</h2></div><div className="mt-7 space-y-3">{FAQS.map((faq,i)=><div key={faq.q} className="overflow-hidden rounded-2xl border border-[#ded5c3] bg-[#fbfaf5]"><button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="flex w-full items-center justify-between gap-4 p-4 text-left font-black"><span>{faq.q}</span><ChevronDown className={"shrink-0 transition " + (openFaq===i?"rotate-180":"")} size={18}/></button>{openFaq===i&&<p className="px-4 pb-4 text-sm leading-7 text-[#6d786b]">{faq.a}</p>}</div>)}</div></div></section>
      <section id="methi-order" className="scroll-mt-5 bg-[#20382d] px-4 py-12 text-white sm:py-16"><div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[.85fr_1.15fr]"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#efd49d]"><ShoppingBag size={14}/> অর্ডার সেকশন</div><h2 className="mt-4 text-3xl font-black sm:text-4xl">আপনার প্যাকেজটি বেছে নিন</h2><p className="mt-3 text-sm leading-7 text-[#d3ddcf]">প্যাকেজ, মূল্য ও ডেলিভারি চার্জ দেখে অর্ডার ফর্ম পূরণ করুন।</p><div className="mt-6 flex items-center gap-3 text-sm text-[#f1d39a]"><ShieldCheck size={20}/> নিরাপদ অর্ডার প্রক্রিয়া</div><div className="mt-3 flex items-center gap-3 text-sm text-[#f1d39a]"><Truck size={20}/> ঠিকানায় ডেলিভারি</div></div>
        <div className="rounded-[2rem] bg-[#fbfaf5] p-4 text-[#20382d] shadow-2xl sm:p-6">
          {packages.length>0?<div className="space-y-3">{packages.map((p,i)=><button key={p.id+i} onClick={()=>setSelected(i)} className={"flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition "+(selected===i?"border-[#b9843f] bg-[#f4eddd] ring-2 ring-[#b9843f]/20":"border-[#e5dfd2] bg-white")}><span className={"grid h-5 w-5 place-items-center rounded-full border "+(selected===i?"border-[#b9843f] bg-[#b9843f] text-white":"border-slate-300")}>{selected===i&&<CheckCircle2 size={15}/>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-black">{p.name}</span><span className="mt-1 block text-xs text-slate-500">{p.oldPrice&&p.oldPrice>p.price?<><span className="line-through">{taka(p.oldPrice)}</span> · </>:""}{taka(p.price)}</span></span></button>)}</div>:<div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Admin Edit Section থেকে মূল পণ্য ও মূল্য যুক্ত না করা পর্যন্ত অর্ডার নেওয়া যাবে না।</div>}
          <form onSubmit={submit} className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-[#f0eee6] p-3"><span className="text-sm font-bold">পরিমাণ</span><div className="flex items-center gap-3"><button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-black">−</button><span className="min-w-5 text-center font-black">{quantity}</span><button type="button" onClick={()=>setQuantity(q=>Math.min(10,q+1))} className="grid h-8 w-8 place-items-center rounded-full bg-white font-black">+</button></div></div>
            <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="আপনার নাম *" className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-sm outline-none focus:border-[#b9843f]"/>
            <input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="মোবাইল নম্বর *" inputMode="tel" className="w-full rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-sm outline-none focus:border-[#b9843f]"/>
            <textarea required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="সম্পূর্ণ ঠিকানা *" rows={3} className="w-full resize-y rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-sm outline-none focus:border-[#b9843f]"/>
            <textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="অতিরিক্ত নির্দেশনা (ঐচ্ছিক)" rows={2} className="w-full resize-y rounded-xl border border-[#ded8ca] bg-white px-4 py-3 text-sm outline-none focus:border-[#b9843f]"/>
            <div className="space-y-2 rounded-2xl bg-[#f0eee6] p-4 text-sm"><div className="flex justify-between"><span>পণ্যের মূল্য</span><b>{taka(subtotal)}</b></div><div className="flex justify-between"><span>ডেলিভারি চার্জ</span><b className="text-emerald-700">ফ্রি</b></div><div className="flex justify-between border-t border-[#d8d2c4] pt-2 text-base"><b>সর্বমোট</b><b className="text-[#a87534]">{taka(total)}</b></div></div>
            <button type="submit" disabled={submitting||!chosen||chosen.price<=0} className="w-full rounded-2xl bg-[#c28b3c] px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{submitting?"অর্ডার প্রসেস হচ্ছে...":"অর্ডার কনফার্ম করুন"} <ArrowRight className="ml-1 inline" size={17}/></button><p className="text-center text-[11px] leading-5 text-[#778174]">অর্ডার জমা হলে এটি আমাদের নিয়মিত Orders সেকশনে যুক্ত হবে।</p>
          </form>
        </div></div></section>
    </main>
    <footer className="bg-[#172b22] px-4 py-8 text-center text-xs leading-6 text-[#d4ddcf]"><div className="font-black tracking-wide text-[#f1d39a]">মেথি মিক্স পাউডার</div><p className="mt-1">উপাদান, মূল্য ও ব্যবহারবিধি সম্পর্কে জেনে সচেতনভাবে অর্ডার করুন।</p><p className="mt-2 text-[10px] text-[#aeb9a8]">এটি খাদ্যপণ্য; চিকিৎসা বা ওষুধের বিকল্প নয়।</p></footer>
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d9d1c1] bg-[#fbfaf5]/95 p-2 shadow-lg backdrop-blur md:hidden"><div className="mx-auto flex max-w-lg items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] text-[#7b8478]">প্যাকেজ মূল্য</div><div className="truncate text-sm font-black text-[#20382d]">{chosen&&chosen.price>0?taka(chosen.price):"মূল্য নির্ধারণাধীন"}</div></div><button onClick={scrollOrder} className="rounded-xl bg-[#c28b3c] px-5 py-3 text-sm font-black text-white">অর্ডার করুন <ArrowRight className="ml-1 inline" size={14}/></button></div></div>
  </div>;
}
