import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, Star, MessageCircle, FileText, ChevronRight, PackageCheck } from "lucide-react";
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
  const reviewsQ = useQuery({ queryKey:["quick-view-review-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{ const {count}=await db.from("product_reviews").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved"); return count??0; } });
  const questionsQ = useQuery({ queryKey:["quick-view-question-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{ const {count}=await db.from("product_questions").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved"); return count??0; } });

  const addItem=()=>{ add({id:product.id,name:product.name,slug:product.slug,price,image:img,stock:product.stock},1); trackAddToCart({id:product.id,name:product.name,price,quantity:1}); };
  const handleAdd=()=>{ addItem(); toastAddedToCart(product.name); onClose(); };
  useEffect(()=>{ const old=document.body.style.overflow; document.body.style.overflow="hidden"; trackViewContent({id:product.id,name:product.name,price}); return()=>{document.body.style.overflow=old;}; },[product.id,product.name,price]);

  const nav=[
    {id:"desc" as Section,label:"📦 বিবরণ",icon:FileText},
    {id:"reviews" as Section,label:`⭐ রিভিউ${reviewsQ.data?` (${reviewsQ.data})`:""}`,icon:Star},
    {id:"qa" as Section,label:`💬 জিজ্ঞাসা${questionsQ.data?` (${questionsQ.data})`:""}`,icon:MessageCircle}
  ];

  const modal=<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-3 py-4 sm:py-6 backdrop-blur-[4px] animate-fade-in sm:px-5" role="dialog" aria-modal="true" aria-label={product.name}>
    <div className="absolute inset-0" onClick={onClose}/>
    <div className="relative flex h-auto w-full max-w-[620px] flex-col overflow-visible rounded-[24px] border border-white/25 bg-background shadow-[0_30px_100px_rgba(0,0,0,.38)] ring-1 ring-black/5 animate-scale-in sm:max-w-[680px] sm:rounded-[28px]">
      <button onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-foreground shadow-lg ring-1 ring-black/10 backdrop-blur transition hover:scale-105 active:scale-95"><X className="h-4 w-4"/></button>
      <div className="shrink-0 border-b border-border/60 bg-background px-2.5 py-2 sm:px-3.5 sm:py-2.5">
        <div className="flex items-center gap-1 rounded-[14px] border border-border/50 bg-muted/45 p-1 shadow-inner">
          {nav.map(item=>{const Icon=item.icon,active=activeSection===item.id;return <button key={item.id} type="button" onClick={()=>setActiveSection(item.id)} className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-1 py-2 text-[10px] font-black transition-all duration-200 sm:text-xs ${active?"bg-background text-brand-dark shadow-[0_3px_12px_rgba(0,0,0,.08)] ring-1 ring-black/5":"text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}><Icon className={`h-3.5 w-3.5 ${active&&item.id==="reviews"?"fill-amber-400 text-amber-400":""}`}/><span className="truncate">{item.label}</span></button>})}
        </div>
      </div>

      <div className="flex flex-col">
        {activeSection==="desc" && <div className="flex flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="relative mx-auto h-[235px] w-full max-w-[590px] shrink-0 overflow-hidden rounded-[18px] bg-muted/40 ring-1 ring-border/60 shadow-sm sm:h-[285px] sm:max-w-[640px] sm:rounded-[20px]">
            <img src={toImg(img,{w:900,q:86})} srcSet={imgSrcSet(img,[450,700,900])} sizes="(min-width:640px) 640px, 100vw" decoding="async" alt={product.name} className="h-full w-full object-contain"/>
            {discount>0&&<span className="absolute left-2.5 top-2.5 rounded-full bg-destructive px-2.5 py-1 text-[9px] font-black text-white shadow">{discount}% ছাড়</span>}
          </div>

          <div className="mx-auto mt-2.5 max-w-[590px] text-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-brand/10 bg-brand-light/70 px-2.5 py-0.5 text-[8px] font-extrabold text-brand-dark"><PackageCheck className="h-3 w-3"/> Sheikh Seeds</div>
            <h2 className="mt-1 text-[19px] font-black leading-tight tracking-tight sm:text-[21px]">{product.name}</h2>
            <button type="button" onClick={()=>setActiveSection("reviews")} className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground"><span className="inline-flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-amber-400"/> 5.0</span><span>({bnDigits(reviewsQ.data??0)}টি রিভিউ)</span></button>
          </div>

          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="text-[25px] font-black tracking-tight text-brand-dark">{taka(price)}</span>
            {product.sale_price&&<span className="text-[11px] font-semibold text-muted-foreground line-through">{taka(product.price)}</span>}
            {discount>0&&<span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[9px] font-black text-destructive">{discount}% ছাড়</span>}
          </div>

          <p className="mx-auto mt-1 max-w-[590px] line-clamp-3 text-center text-[12px] leading-5 text-muted-foreground">{product.short_description||product.description||"সঠিক যত্নে চমৎকার ফলন পাওয়ার জন্য বাছাই করা মানসম্মত বীজ।"}</p>

          <div className="mx-auto mt-2.5 flex w-full max-w-[590px] items-center justify-between rounded-xl border border-brand/10 bg-brand-light/30 px-3 py-2">
            <div className={`flex items-center gap-1.5 text-[11px] font-black ${product.stock>0?"text-emerald-600":"text-destructive"}`}><span className={`h-1.5 w-1.5 rounded-full ${product.stock>0?"bg-emerald-500":"bg-red-500"}`}/>{product.stock>0?"✓ স্টকে আছে":"স্টক নেই"}</div>
            <span className="text-[10px] font-semibold text-muted-foreground">{product.stock>0?"দ্রুত ডেলিভারি":"শীঘ্রই আসছে"}</span>
          </div>

          <button onClick={handleAdd} disabled={product.stock<=0} className="mx-auto mt-2.5 flex w-full max-w-[590px] items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-black text-white shadow-[0_8px_22px_rgba(34,139,79,.2)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark active:translate-y-0 disabled:opacity-50"><ShoppingCart className="h-4 w-4"/>কার্টে যোগ করুন</button>

          <Link to="/product/$slug" params={{slug:product.slug}} onClick={onClose} className="mx-auto mt-1.5 flex w-fit items-center gap-1 text-[10px] font-extrabold text-brand-dark underline underline-offset-4">সম্পূর্ণ পণ্য পেজ দেখুন <ChevronRight className="h-3 w-3"/></Link>
        </div>}

        {activeSection!=="desc" && isUuid(product.id) && <div className="px-2 pb-3 pt-1.5 sm:px-3"><ProductTabs productId={String(product.id)} description={product.description} activeTab={activeSection} onTabChange={setActiveSection} hideNav/></div>}
      </div>
    </div>
  </div>;
  return typeof document!=="undefined"?createPortal(modal,document.body):null;
}
