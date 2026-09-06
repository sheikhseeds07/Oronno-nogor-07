import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, Star, MessageCircle, FileText, ChevronRight, PackageCheck, Check } from "lucide-react";
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
  const reviewsQ = useQuery({ queryKey:["quick-view-review-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{const {count}=await db.from("product_reviews").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved");return count??0;} });
  const questionsQ = useQuery({ queryKey:["quick-view-question-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{const {count}=await db.from("product_questions").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved");return count??0;} });

  const addItem=()=>{add({id:product.id,name:product.name,slug:product.slug,price,image:img,stock:product.stock},1);trackAddToCart({id:product.id,name:product.name,price,quantity:1});};
  const handleAdd=()=>{addItem();toastAddedToCart(product.name);onClose();};
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow="hidden";trackViewContent({id:product.id,name:product.name,price});return()=>{document.body.style.overflow=old;};},[product.id,product.name,price]);

  const nav=[
    {id:"desc" as Section,label:"📦 বিবরণ",icon:FileText},
    {id:"reviews" as Section,label:`⭐ রিভিউ${reviewsQ.data?` ${bnDigits(reviewsQ.data)}`:""}`,icon:Star},
    {id:"qa" as Section,label:`💬 জিজ্ঞাসা${questionsQ.data?` ${bnDigits(questionsQ.data)}`:""}`,icon:MessageCircle}
  ];

  const modal=<div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 backdrop-blur-[3px] animate-fade-in sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={product.name}>
    <div className="absolute inset-0" onClick={onClose}/>
    <div className="relative flex h-[min(91vh,760px)] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[26px] border border-white/25 bg-background shadow-[0_-18px_70px_rgba(0,0,0,.25)] animate-scale-in sm:h-[min(760px,92vh)] sm:rounded-[28px] sm:shadow-[0_30px_100px_rgba(0,0,0,.38)]">
      <button onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-md ring-1 ring-black/5 backdrop-blur transition hover:scale-105 active:scale-95"><X className="h-4 w-4"/></button>

      <div className="shrink-0 border-b border-border/50 bg-background px-3 pb-3 pt-3 sm:px-4">
        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/45 p-1 shadow-inner">
          {nav.map(item=>{const Icon=item.icon,active=activeSection===item.id;return <button key={item.id} type="button" onClick={()=>setActiveSection(item.id)} className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-[11px] font-black transition-all duration-200 sm:text-xs ${active?"bg-background text-foreground shadow-[0_3px_12px_rgba(0,0,0,.08)] ring-1 ring-black/5":"text-muted-foreground hover:bg-background/70"}`}><Icon className={`h-4 w-4 ${active&&item.id==="reviews"?"fill-amber-400 text-amber-400":""}`}/><span className="truncate">{item.label}</span></button>})}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeSection==="desc" && <div className="px-3 pb-5 pt-3 sm:px-5 sm:pb-6 sm:pt-4">
          <div className="relative mx-auto w-full overflow-hidden rounded-[20px] bg-muted/30 ring-1 ring-border/50 shadow-sm sm:rounded-[22px]">
            <div className="flex h-[300px] w-full items-center justify-center sm:h-[330px]">
              <img src={toImg(img,{w:900,q:88})} srcSet={imgSrcSet(img,[500,700,900])} sizes="(max-width: 640px) 100vw, 500px" decoding="async" alt={product.name} className="h-full w-full object-contain"/>
            </div>
            {discount>0&&<span className="absolute left-3 top-3 rounded-lg bg-destructive px-2.5 py-1.5 text-[10px] font-black text-white shadow">{bnDigits(discount)}% ছাড়</span>}
          </div>

          <div className="mt-4 px-0.5">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-brand-dark"><PackageCheck className="h-3.5 w-3.5"/> Sheikh Seeds</div>
            <h2 className="mt-1.5 text-[22px] font-black leading-tight tracking-tight sm:text-[24px]">{product.name}</h2>
            <button type="button" onClick={()=>setActiveSection("reviews")} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-brand-dark"><span className="inline-flex items-center gap-0.5 text-amber-500"><Star className="h-4 w-4 fill-amber-400"/><Star className="h-4 w-4 fill-amber-400"/><Star className="h-4 w-4 fill-amber-400"/><Star className="h-4 w-4 fill-amber-400"/><Star className="h-4 w-4"/> </span><b className="text-sm text-foreground">4.0</b><span>({bnDigits(reviewsQ.data??0)}টি রিভিউ)</span></button>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="text-[30px] font-black leading-none tracking-tight text-brand-dark">{taka(price)}</span>
              {product.sale_price&&<span className="text-[15px] font-semibold text-muted-foreground line-through">{taka(product.price)}</span>}
              {discount>0&&<span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-600">{bnDigits(discount)}% ছাড়</span>}
              {product.stock>0&&<span className="text-[12px] font-bold text-amber-700">৳2 ক্যাশব্যাক</span>}
            </div>

            <p className="mt-3 text-[14px] leading-6 text-muted-foreground sm:text-[15px]">{product.short_description||product.description||"সঠিক যত্নে চমৎকার ফলন পাওয়ার জন্য বাছাই করা মানসম্মত বীজ।"}</p>

            <div className="mt-3 flex items-center gap-1.5 text-[13px] font-black text-emerald-600"><Check className="h-4 w-4"/>স্টকে আছে</div>

            <button onClick={handleAdd} disabled={product.stock<=0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-brand py-3.5 text-[17px] font-black text-white shadow-[0_8px_24px_rgba(34,139,79,.2)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark active:translate-y-0 disabled:opacity-50"><ShoppingCart className="h-5 w-5"/>কার্টে যোগ করুন</button>

            <Link to="/product/$slug" params={{slug:product.slug}} onClick={onClose} className="mx-auto mt-4 flex w-fit items-center gap-1 text-[13px] font-extrabold text-muted-foreground hover:text-brand-dark">সম্পূর্ণ পণ্য পেজ দেখুন <ChevronRight className="h-4 w-4"/></Link>
          </div>
        </div>}

        {activeSection!=="desc" && isUuid(product.id) && <div className="h-full px-2 pb-5 pt-1.5 sm:px-3"><ProductTabs productId={String(product.id)} description={product.description} activeTab={activeSection} onTabChange={setActiveSection} hideNav/></div>}
      </div>
    </div>
  </div>;
  return typeof document!=="undefined"?createPortal(modal,document.body):null;
}
