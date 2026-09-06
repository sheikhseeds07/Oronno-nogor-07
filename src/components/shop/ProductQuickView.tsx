import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, Minus, Plus, ShoppingCart, Zap, Star, MessageCircle, FileText, ChevronRight } from "lucide-react";
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
  const add = useCart(s => s.add), navigate = useNavigate();
  const [qty, setQty] = useState(1), [activeSection, setActiveSection] = useState<Section>("desc");
  const price = product.sale_price ?? product.price, discount = product.sale_price ? Math.round(((product.price-product.sale_price)/product.price)*100) : 0;
  const img = product.images?.[0] || "/placeholder.svg";
  const reviewsQ = useQuery({ queryKey:["quick-view-review-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{const {count}=await db.from("product_reviews").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved");return count??0;} });
  const questionsQ = useQuery({ queryKey:["quick-view-question-count",product.id], enabled:isUuid(product.id), staleTime:60000, queryFn:async()=>{const {count}=await db.from("product_questions").select("id",{count:"exact",head:true}).eq("product_id",product.id).eq("status","approved");return count??0;} });
  const addItem=()=>{add({id:product.id,name:product.name,slug:product.slug,price,image:img,stock:product.stock},qty);trackAddToCart({id:product.id,name:product.name,price,quantity:qty});};
  const handleAdd=()=>{addItem();toastAddedToCart(product.name);onClose();};
  const handleOrderNow=()=>{addItem();onClose();navigate({to:"/checkout"});};
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow="hidden";trackViewContent({id:product.id,name:product.name,price});return()=>{document.body.style.overflow=old;};},[product.id,product.name,price]);
  const nav=[{id:"desc" as Section,label:"📦 বিবরণ",icon:FileText},{id:"reviews" as Section,label:`⭐ রিভিউ${reviewsQ.data?` (${reviewsQ.data})`:""}`,icon:Star},{id:"qa" as Section,label:`💬 জিজ্ঞাসা${questionsQ.data?` (${questionsQ.data})`:""}`,icon:MessageCircle}];
  const modal=<div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 p-0 backdrop-blur-[3px] animate-fade-in sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={product.name}>
    <div className="absolute inset-0" onClick={onClose}/>
    <div className="relative flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-background shadow-[0_30px_100px_rgba(0,0,0,.3)] animate-scale-in sm:max-h-[86vh] sm:rounded-[24px]">
      <div className="shrink-0 border-b bg-background/95 px-3 pt-2 backdrop-blur-xl sm:px-4"><div className="mx-auto mb-1.5 h-1 w-9 rounded-full bg-muted sm:hidden"/><div className="flex items-center gap-0.5 rounded-xl bg-muted/55 p-1">{nav.map(item=>{const Icon=item.icon,active=activeSection===item.id;return <button key={item.id} type="button" onClick={()=>setActiveSection(item.id)} className={`relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-extrabold transition-all sm:text-xs ${active?"bg-background text-brand-dark shadow-sm":"text-muted-foreground"}`}><Icon className={`h-3.5 w-3.5 ${active&&item.id==="reviews"?"fill-amber-400 text-amber-400":""}`}/><span className="truncate">{item.label}</span></button>})}</div></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeSection==="desc" && <div className="p-3.5 sm:p-5">
          <div className="relative mx-auto h-[185px] w-full max-w-[260px] overflow-hidden rounded-2xl bg-muted sm:h-[220px] sm:max-w-[300px]"><img src={toImg(img,{w:600,q:82})} srcSet={imgSrcSet(img,[300,450,600])} sizes="(max-width:640px) 90vw,300px" decoding="async" alt={product.name} className="h-full w-full object-contain"/>{discount>0&&<span className="absolute left-2.5 top-2.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-black text-white shadow">{discount}% ছাড়</span>}<button onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-md transition hover:scale-105 active:scale-95"><X className="h-4 w-4"/></button></div>
          <div className="mt-3 text-center"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AB Seed · প্রিমিয়াম বীজ</div><h2 className="mt-1 text-lg font-black leading-tight tracking-tight sm:text-xl">{product.name}</h2><div className="mt-1.5 flex items-center justify-center gap-1.5"><span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-500"><Star className="h-3.5 w-3.5 fill-amber-400"/>5.0</span><button type="button" onClick={()=>setActiveSection("reviews")} className="text-[11px] font-bold text-muted-foreground underline underline-offset-2">({bnDigits(reviewsQ.data??0)}টি রিভিউ)</button></div></div>
          <div className="mt-3 flex items-center justify-center gap-2"><span className="text-2xl font-black text-brand-dark">{taka(price)}</span>{product.sale_price&&<span className="text-xs font-semibold text-muted-foreground line-through">{taka(product.price)}</span>}{discount>0&&<span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-black text-destructive">{discount}% ছাড়</span>}</div>
          <p className="mx-auto mt-2 max-w-lg line-clamp-2 text-center text-xs leading-5 text-muted-foreground">{product.short_description||product.description||"সঠিক যত্নে চমৎকার ফলন পাওয়ার জন্য বাছাই করা মানসম্মত বীজ।"}</p>
          <div className="mx-auto mt-3 flex max-w-lg items-center justify-between rounded-xl border bg-muted/20 p-2.5"><div className={`text-xs font-extrabold ${product.stock>0?"text-emerald-600":"text-destructive"}`}>{product.stock>0?"✓ স্টকে আছে":"স্টক নেই"}</div><div className="flex items-center overflow-hidden rounded-lg border bg-background"><button onClick={()=>setQty(q=>Math.max(1,q-1))} className="grid h-8 w-8 place-items-center hover:bg-muted" aria-label="কমাও"><Minus className="h-3.5 w-3.5"/></button><span className="grid h-8 min-w-8 place-items-center border-x text-xs font-black">{bnDigits(qty)}</span><button onClick={()=>setQty(q=>Math.min(product.stock||99,q+1))} className="grid h-8 w-8 place-items-center hover:bg-muted" aria-label="বাড়াও"><Plus className="h-3.5 w-3.5"/></button></div></div>
          <div className="mx-auto mt-2 grid max-w-lg grid-cols-2 gap-2"><button onClick={handleAdd} disabled={product.stock<=0} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-brand py-2.5 text-xs font-black text-brand transition active:scale-[.98] disabled:opacity-50"><ShoppingCart className="h-4 w-4"/>কার্টে যোগ</button><button onClick={handleOrderNow} disabled={product.stock<=0} className="flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-black text-white shadow-md transition active:scale-[.98] disabled:opacity-50"><Zap className="h-4 w-4"/>এখনই অর্ডার</button></div>
          <Link to="/product/$slug" params={{slug:product.slug}} onClick={onClose} className="mx-auto mt-3 flex w-fit items-center gap-1 text-xs font-extrabold text-brand-dark underline underline-offset-4">বিস্তারিত দেখুন <ChevronRight className="h-3.5 w-3.5"/></Link>
        </div>}
        {activeSection!=="desc" && isUuid(product.id) && <div className="px-3 pb-5 pt-2 sm:px-4"><ProductTabs productId={String(product.id)} description={product.description} activeTab={activeSection} onTabChange={setActiveSection} hideNav/></div>}
      </div>
    </div>
  </div>;
  return typeof document!=="undefined"?createPortal(modal,document.body):null;
}
