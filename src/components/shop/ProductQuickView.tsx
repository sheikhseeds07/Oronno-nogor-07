import { SafeImage } from "@/components/SafeImage";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, Star, MessageCircle, FileText, PackageCheck, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { toastAddedToCart } from "@/lib/cart-toast";
import type { Product } from "./ProductCard";
import { trackAddToCart, trackViewContent } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";
import { ProductTabs } from "@/components/community/ProductTabs";
import { db } from "@/lib/customer-account";

type Section = "desc" | "reviews" | "qa";
function isUuid(v: unknown) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }

export function ProductQuickView({ product, onClose }: { product: Product & { description?: string; short_description?: string }; onClose: () => void }) {
  const add = useCart(s => s.add);
  const [activeSection, setActiveSection] = useState<Section>("desc");
  const price = product.sale_price ?? product.price;
  const discount = product.sale_price ? Math.round(((product.price - product.sale_price) / product.price) * 100) : 0;
  const img = product.images?.[0] || "/placeholder.svg";
  const reviewsQ = useQuery({ queryKey:["quick-view-review-count",product.id], enabled:isUuid(product.id), staleTime: 5 * 60_000, queryFn:async()=>{ const {count}=await db.from("product_reviews").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved"); return count??0; } });
  const questionsQ = useQuery({ queryKey:["quick-view-question-count",product.id], enabled:isUuid(product.id), staleTime: 5 * 60_000, queryFn:async()=>{ const {count}=await db.from("product_questions").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved"); return count??0; } });

  const addItem=()=>{ add({id:product.id,name:product.name,slug:product.slug,price,image:img,stock:product.stock},1); trackAddToCart({id:product.id,name:product.name,price,quantity:1}); };
  const handleAdd=()=>{ addItem(); toastAddedToCart(product.name); onClose(); };
  useEffect(()=>{ const old=document.body.style.overflow; document.body.style.overflow="hidden"; trackViewContent({id:product.id,name:product.name,price}); return()=>{document.body.style.overflow=old;}; },[product.id,product.name,price]);

  const nav=[
    {id:"desc" as Section,label:"📦 বিবরণ",icon:FileText},
    {id:"reviews" as Section,label:`⭐ রিভিউ${reviewsQ.data?` (${reviewsQ.data})`:""}`,icon:Star},
    {id:"qa" as Section,label:`💬 জিজ্ঞাসা${questionsQ.data?` (${questionsQ.data})`:""}`,icon:MessageCircle}
  ];

  const modal=<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 px-2.5 py-3 sm:px-5 sm:py-5 backdrop-blur-[6px] animate-fade-in" role="dialog" aria-modal="true" aria-label={product.name}>
    <div className="absolute inset-0" onClick={onClose}/>
    <div className="relative flex h-[min(590px,calc(100dvh-20px))] w-full max-w-[600px] flex-col overflow-hidden bg-background shadow-[0_35px_100px_rgba(0,0,0,.42)] ring-1 ring-white/15 animate-scale-in sm:h-[min(625px,calc(100dvh-32px))] sm:max-w-[660px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent animate-pulse"/>
      <button onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-2.5 top-2.5 z-30 grid h-8 w-8 place-items-center bg-white/95 text-foreground shadow-lg ring-1 ring-black/10 backdrop-blur transition-all duration-200 hover:scale-110 hover:bg-white hover:shadow-xl active:scale-90"><X className="h-4 w-4"/></button>
      <div className="shrink-0 border-b border-border/50 bg-background px-1.5 py-1 sm:px-2.5 sm:py-1.5">
        <div className="flex items-center gap-0.5 border border-border/40 bg-muted/30 p-0.5 shadow-inner">
          {nav.map(item=>{const Icon=item.icon,active=activeSection===item.id;return <button key={item.id} type="button" onClick={()=>setActiveSection(item.id)} className={`group relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1 py-1.5 text-[10px] font-black transition-all duration-300 sm:py-1.5 sm:text-xs ${active?"bg-background text-brand-dark shadow-[0_2px_10px_rgba(0,0,0,.08)]":"text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}><Icon className={`h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110 ${active&&item.id==="reviews"?"fill-amber-400 text-amber-400":""}`}/><span className="truncate">{item.label}</span>{active&&<span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-center animate-pulse bg-brand"/>}</button>})}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSection==="desc" && <div className="h-full overflow-hidden px-2.5 pb-2.5 pt-2 sm:px-4 sm:pb-3 sm:pt-2.5">
          <div className="relative mx-auto h-[210px] w-full max-w-[590px] shrink-0 overflow-hidden bg-muted/25 ring-1 ring-border/40 shadow-[0_10px_35px_rgba(0,0,0,.08)] sm:h-[245px] sm:max-w-[640px]">
            <SafeImage src={toImg(img,{w:1000,q:88})} srcSet={imgSrcSet(img,[500,800,1000])} sizes="(min-width:640px) 640px, 100vw" decoding="async" alt={product.name} className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.025]"/>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5"/>
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent animate-pulse"/>
            {discount>0&&<span className="absolute left-2.5 top-2.5 bg-destructive px-2.5 py-1 text-[9px] font-black text-white shadow-lg">{discount}% ছাড়</span>}
          </div>

          <div className="mx-auto mt-1.5 max-w-[590px] text-center">
            <div className="inline-flex items-center gap-1 border border-brand/10 bg-brand-light/60 px-2 py-0.5 text-[8px] font-extrabold text-brand-dark"><PackageCheck className="h-3 w-3"/> Sheikh Seeds</div>
            <h2 className="mt-0.5 text-[18px] font-black leading-tight tracking-tight sm:text-[20px]">{product.name}</h2>
            <button type="button" onClick={()=>setActiveSection("reviews")} className="mt-0 inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground transition-colors hover:text-foreground"><span className="inline-flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-amber-400 animate-pulse"/> 5.0</span><span>({bnDigits(reviewsQ.data??0)}টি রিভিউ)</span></button>
          </div>

          <div className="mt-0.5 flex items-center justify-center gap-2">
            <span className="text-[23px] font-black tracking-tight text-brand-dark">{taka(price)}</span>
            {product.sale_price&&<span className="text-[10px] font-semibold text-muted-foreground line-through">{taka(product.price)}</span>}
            {discount>0&&<span className="bg-destructive/10 px-1.5 py-0.5 text-[9px] font-black text-destructive">{discount}% ছাড়</span>}
          </div>

          <p className="mx-auto mt-0 max-w-[590px] line-clamp-2 text-center text-[11px] leading-4 text-muted-foreground">{product.short_description||product.description||"সঠিক যত্নে চমৎকার ফলন পাওয়ার জন্য বাছাই করা মানসম্মত বীজ।"}</p>

          <div className="mx-auto mt-1.5 flex w-full max-w-[590px] items-center justify-between border border-brand/10 bg-brand-light/20 px-3 py-1.5">
            <div className={`flex items-center gap-1.5 text-[10px] font-black ${product.stock>0?"text-emerald-600":"text-destructive"}`}><span className={`h-1.5 w-1.5 animate-pulse ${product.stock>0?"bg-emerald-500":"bg-red-500"}`}/>{product.stock>0?"✓ স্টকে আছে":"স্টক নেই"}</div>
            <span className="text-[9px] font-semibold text-muted-foreground">{product.stock>0?"দ্রুত ডেলিভারি":"শীঘ্রই আসছে"}</span>
          </div>

          <button onClick={handleAdd} disabled={product.stock<=0} className="group mx-auto mt-1.5 flex w-full max-w-[590px] items-center justify-center gap-1.5 overflow-hidden bg-brand py-2.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(34,139,79,.22)] transition-all duration-300 hover:bg-brand-dark hover:shadow-[0_14px_30px_rgba(34,139,79,.28)] active:scale-[.99] disabled:opacity-50"><span className="absolute -translate-x-[140%] opacity-0 transition-all duration-700 group-hover:translate-x-[140%] group-hover:opacity-100 h-20 w-12 rotate-12 bg-white/20"/><ShoppingCart className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"/>কার্টে যোগ করুন</button>

          <Link to="/product/$slug" params={{slug:product.slug}} onClick={onClose} className="mx-auto mt-1.5 flex w-fit items-center gap-1 text-[10px] font-extrabold text-brand-dark underline underline-offset-4 transition-colors hover:text-brand hover:no-underline">সম্পূর্ণ পণ্য পেজ দেখুন <ChevronRight className="h-3 w-3"/></Link>
        </div>}

        {activeSection!=="desc" && isUuid(product.id) && <div className="h-full overflow-y-auto scrollbar-none px-2 pb-2 pt-1 sm:px-3"><ProductTabs productId={String(product.id)} description={product.description} activeTab={activeSection} onTabChange={setActiveSection} hideNav/></div>}
      </div>
    </div>
  </div>;
  return typeof document!=="undefined"?createPortal(modal,document.body):null;
}
