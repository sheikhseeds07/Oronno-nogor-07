import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { Minus, Plus, ShoppingCart, Zap, ShieldCheck, Truck, BadgeCheck, PackageCheck, ChevronLeft, Share2, Check, Sparkles } from "lucide-react";
import { toastAddedToCart } from "@/lib/cart-toast";
import { trackAddToCart, trackViewContent } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";
import { ProductTabs } from "@/components/community/ProductTabs";

export const Route = createFileRoute("/product/$slug")({ component: ProductPage });

function ProductPage() {
  const { slug } = useParams({ from: "/product/$slug" });
  const navigate = useNavigate();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name,slug)").eq("slug", slug).maybeSingle();
      if (data) return data;
      const { fallbackProducts } = await import("@/lib/fallback-shop");
      return fallbackProducts.find((item) => item.slug === slug) ?? null;
    },
  });

  const price = p ? (p.sale_price ?? p.price) : 0;
  const oldPrice = p?.sale_price && p.sale_price < p.price ? p.price : null;
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const images: string[] = p?.images?.length ? p.images : ["/placeholder.svg"];
  const imagesKey = images.join(",");

  const { data: relatedProducts = [] } = useQuery({
    queryKey: ["related-products", p?.id, p?.category_id], enabled: !!p,
    queryFn: async () => {
      if (!p) return [] as Product[];
      let query = supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).neq("id", p.id);
      if (p.category_id) query = query.eq("category_id", p.category_id);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  useEffect(() => { if (p) trackViewContent({ id: p.id, name: p.name, price }); }, [p?.id, p?.name, price]);
  useEffect(() => {
    if (!p) return;
    const ld = { "@context": "https://schema.org/", "@type": "Product", name: p.name, image: images, description: p.short_description || p.description || p.name, sku: (p as any).sku || p.id, offers: { "@type": "Offer", priceCurrency: "BDT", price: String(price), availability: (p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: typeof window !== "undefined" ? window.location.href : `https://sheikhseeds.com/product/${p.slug}` } };
    const tag = document.createElement("script"); tag.type = "application/ld+json"; tag.text = JSON.stringify(ld); tag.setAttribute("data-product-ld", p.id); document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [p?.id, p?.name, p?.slug, (p as any)?.sku, p?.stock, p?.short_description, p?.description, price, imagesKey]);

  if (isLoading) return <SiteLayout><div className="container mx-auto px-3 py-10"><BrandLoader /></div></SiteLayout>;
  if (!p) return <SiteLayout><div className="container mx-auto px-3 py-10 text-center">পণ্য পাওয়া যায়নি</div></SiteLayout>;

  const addToCart = () => { add({ id: p.id, name: p.name, slug: p.slug, price, image: images[0], stock: p.stock }, qty); trackAddToCart({ id: p.id, name: p.name, price, quantity: qty }); toastAddedToCart(p.name); };
  const buyNow = () => { add({ id: p.id, name: p.name, slug: p.slug, price, image: images[0], stock: p.stock }, qty); trackAddToCart({ id: p.id, name: p.name, price, quantity: qty }); navigate({ to: "/checkout" }); };
  const shareProduct = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: p.name, text: "Sheikh Seeds-এর এই পণ্যটি দেখুন", url }); else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } } catch {} };

  return (
    <SiteLayout>
      <style>{`
        @keyframes productEntrance{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:none}}
        @keyframes productGlow{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.08)}50%{box-shadow:0 0 0 6px rgba(22,163,74,0)}}
        @keyframes productBadge{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes productShine{0%{transform:translateX(-140%) skewX(-18deg);opacity:0}18%{opacity:1}55%,100%{transform:translateX(220%) skewX(-18deg);opacity:0}}
        @keyframes productFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes productPulse{0%,100%{opacity:.45;transform:scale(.96)}50%{opacity:1;transform:scale(1)}}
        @keyframes productImageGlow{0%,100%{opacity:.2}50%{opacity:.48}}
        @keyframes productLine{0%{transform:translateX(-110%)}100%{transform:translateX(110%)}}
        .product-entrance{animation:productEntrance .55s cubic-bezier(.22,1,.36,1) both}.product-glow{animation:productGlow 2.8s ease-in-out infinite}.product-badge{animation:productBadge 2.5s ease-in-out infinite}.product-float{animation:productFloat 3.2s ease-in-out infinite}.product-pulse{animation:productPulse 2s ease-in-out infinite}.product-image-glow{animation:productImageGlow 3s ease-in-out infinite}.product-live-line{animation:productLine 2.8s linear infinite}
        .product-shine{position:relative}.product-shine::after{content:"";position:absolute;inset:-35% auto -35% -45%;width:28%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.38),transparent);transform:translateX(-140%) skewX(-18deg);animation:productShine 3.6s ease-in-out infinite;pointer-events:none}
        .product-card-hover{transition:transform .3s cubic-bezier(.22,1,.36,1),box-shadow .3s ease,border-color .3s ease}.product-card-hover:hover{transform:translateY(-2px);box-shadow:0 16px 38px -28px rgba(20,83,45,.58);border-color:rgba(34,139,79,.25)}
        @media(prefers-reduced-motion:reduce){.product-entrance,.product-glow,.product-badge,.product-float,.product-pulse,.product-image-glow,.product-shine::after,.product-live-line{animation:none!important}.product-card-hover{transition:none}.product-card-hover:hover{transform:none}}
      `}</style>

      <main className="container mx-auto max-w-6xl px-2 pb-6 pt-1.5 sm:px-3 sm:pb-9 sm:pt-3">
        <div className="mb-1.5 flex items-center justify-between sm:mb-2.5">
          <Link to="/shop" className="group inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-bold text-muted-foreground transition hover:bg-brand-light hover:text-brand-dark"><ChevronLeft className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1" /> শপে ফিরে যান</Link>
          <button onClick={shareProduct} className="product-float inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition hover:border-brand/30 hover:text-brand active:scale-90" aria-label="পণ্য শেয়ার করুন">{copied ? <Check className="h-3.5 w-3.5 text-brand animate-pulse" /> : <Share2 className="h-3.5 w-3.5" />}</button>
        </div>
        <nav className="mb-2 hidden text-[10px] text-muted-foreground sm:block"><Link to="/">হোম</Link><span className="mx-1.5">/</span><Link to="/shop">সকল পণ্য</Link><span className="mx-1.5">/</span><span className="text-foreground">{p.name}</span></nav>

        <section className="product-entrance product-card-hover relative grid overflow-hidden rounded-[16px] border border-brand/10 bg-white shadow-[0_12px_38px_-28px_rgba(20,83,45,.55)] md:grid-cols-[1fr_.94fr]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px overflow-hidden bg-brand/10"><span className="product-live-line block h-full w-1/3 bg-gradient-to-r from-transparent via-brand to-transparent" /></div>
          <div className="relative bg-gradient-to-b from-brand-light/20 via-white to-brand-light/5 p-2 sm:p-3 md:p-3.5">
            <div className="relative aspect-square overflow-hidden rounded-[13px] border border-black/5 bg-white shadow-inner">
              <div className="product-image-glow pointer-events-none absolute -inset-5 rounded-full bg-brand/10 blur-3xl" />
              <img src={toImg(images[activeImg], { w: 1000, q: 84 })} srcSet={imgSrcSet(images[activeImg], [500, 800, 1000, 1200])} sizes="(max-width: 768px) 100vw, 540px" alt={p.name} width={1000} height={1000} fetchPriority="high" decoding="async" className="relative z-10 h-full w-full object-cover transition duration-700 hover:scale-[1.025]" />
              {discount > 0 && <span className="product-badge absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold text-white shadow-lg"><Sparkles className="h-3 w-3 animate-pulse" /> {bnDigits(discount)}% ছাড়</span>}
              {p.stock <= 0 && <span className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 text-sm font-extrabold text-white backdrop-blur-[2px]">স্টক শেষ</span>}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px overflow-hidden bg-white/20"><span className="product-live-line block h-full w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent" /></div>
            </div>
            {images.length > 1 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{images.map((src, i) => <button key={i} onClick={() => setActiveImg(i)} className={`group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-all duration-300 active:scale-95 sm:h-16 sm:w-16 ${i === activeImg ? "border-brand shadow-md ring-2 ring-brand/10" : "border-transparent opacity-70 hover:opacity-100 hover:-translate-y-0.5"}`}><img src={toImg(src, { w: 180, q: 72 })} alt="" width={80} height={80} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /></button>)}</div>}
          </div>

          <div className="flex flex-col p-3 sm:p-4 md:p-5 lg:p-6">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{p.categories?.name && <span className="product-float rounded-full bg-brand-light/65 px-2 py-0.5 text-[9px] font-extrabold text-brand-dark">{p.categories.name}</span>}{p.stock > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700"><span className="product-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" /><BadgeCheck className="h-3 w-3" /> স্টকে আছে</span>}</div>
            <h1 className="text-[21px] font-extrabold leading-[1.25] tracking-[-.02em] text-foreground sm:text-[27px]">{p.name}</h1>
            {"sku" in p && p.sku && <div className="mt-1 text-[9px] font-medium text-muted-foreground">SKU: {String(p.sku)}</div>}
            <div className="my-3 rounded-xl border border-brand/10 bg-gradient-to-r from-brand-light/50 via-brand-light/20 to-brand-light/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] sm:my-3.5"><div className="flex items-end gap-2"><span className="text-[28px] font-black leading-none tracking-tight text-brand-dark sm:text-3xl">{taka(price)}</span>{oldPrice && <span className="mb-0.5 text-xs text-muted-foreground line-through">{taka(oldPrice)}</span>}{discount > 0 && <span className="product-pulse mb-0.5 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[9px] font-extrabold text-destructive">-{bnDigits(discount)}%</span>}</div>{oldPrice && <p className="mt-1 text-[9px] font-semibold text-brand-dark/70">আজকের বিশেষ মূল্য — সীমিত সময়ের অফার</p>}</div>
            {p.short_description && <p className="mb-3 text-[12px] leading-5 text-muted-foreground sm:text-[13px]">{p.short_description}</p>}
            <div className="mb-3 flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 transition-all hover:border-brand/25 hover:bg-brand-light/20"><span className="text-[11px] font-bold">পরিমাণ</span><div className="flex items-center overflow-hidden rounded-md border border-brand/25 bg-white shadow-sm"><button onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-8 w-8 items-center justify-center text-brand transition hover:bg-brand-light active:scale-90"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-8 text-center text-xs font-extrabold text-brand-dark">{bnDigits(qty)}</span><button onClick={() => setQty(Math.min(Math.max(1, p.stock), qty + 1))} disabled={p.stock <= 0 || qty >= p.stock} className="flex h-8 w-8 items-center justify-center text-brand transition hover:bg-brand-light disabled:opacity-35 active:scale-90"><Plus className="h-3.5 w-3.5" /></button></div><span className="text-[9px] font-semibold text-muted-foreground">স্টক: {bnDigits(Math.max(0, p.stock))}</span></div>
            <div className="grid grid-cols-2 gap-2"><button onClick={addToCart} disabled={p.stock <= 0} className="product-shine product-glow relative flex h-10 items-center justify-center gap-1 overflow-hidden rounded-lg border-2 border-brand bg-white px-2 text-[11px] font-extrabold text-brand-dark transition-all hover:-translate-y-0.5 hover:bg-brand-light disabled:opacity-45 active:scale-[.98] sm:text-xs"><ShoppingCart className="relative z-10 h-4 w-4" /><span className="relative z-10">কার্টে যোগ করুন</span></button><button onClick={buyNow} disabled={p.stock <= 0} className="product-shine relative flex h-10 items-center justify-center gap-1 overflow-hidden rounded-lg bg-gradient-to-r from-brand to-brand-dark px-2 text-[11px] font-extrabold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-45 active:scale-[.98] sm:text-xs"><Zap className="relative z-10 h-4 w-4" /><span className="relative z-10">এখনই অর্ডার</span></button></div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2"><TrustItem icon={<Truck />} title="হোম ডেলিভারি" /><TrustItem icon={<ShieldCheck />} title="১০০% অরিজিনাল" /><TrustItem icon={<PackageCheck />} title="ক্যাশ অন ডেলিভারি" /></div>
          </div>
        </section>

        <section className="product-entrance mt-3 overflow-hidden rounded-[14px] border border-brand/10 bg-white shadow-[0_8px_28px_-24px_rgba(20,83,45,.5)] sm:mt-4">
          <div className="flex items-center gap-2 border-b border-brand/10 bg-gradient-to-r from-brand-light/30 to-white px-3 py-2.5 sm:px-4"><span className="h-5 w-1 rounded-full bg-brand" /><div><h2 className="text-sm font-extrabold leading-none text-brand-dark sm:text-base">পণ্যের বিস্তারিত</h2><p className="mt-0.5 text-[9px] text-muted-foreground">বিস্তারিত তথ্য, রিভিউ ও প্রশ্ন</p></div></div>
          <div className="compact-product-tabs">{isUuid(p.id) ? <ProductTabs productId={String(p.id)} description={p.description} /> : p.description && <div className="px-3 py-3 sm:px-4 sm:py-4"><div className="prose prose-sm max-w-none whitespace-pre-wrap text-[12px] leading-6 text-muted-foreground sm:text-[13px] sm:leading-6">{p.description}</div></div>}</div>
        </section>

        {relatedProducts.length > 0 && <section className="mt-5 sm:mt-7"><div className="mb-2.5 flex items-end justify-between px-0.5 sm:mb-3"><div><p className="mb-0.5 text-[9px] font-bold uppercase tracking-[.15em] text-brand/65">You may also like</p><h2 className="text-lg font-extrabold tracking-tight text-brand-dark sm:text-xl">আপনার জন্য সাজেশন</h2></div><Link to="/shop" className="rounded-full bg-brand-light/60 px-2.5 py-1 text-[9px] font-extrabold text-brand-dark transition hover:bg-brand-light sm:text-[10px]">সব পণ্য দেখুন →</Link></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{relatedProducts.map((item, i) => <div key={item.id} className="product-entrance" style={{ animationDelay: `${i * 70}ms` }}><ProductCard p={item} /></div>)}</div></section>}
      </main>
    </SiteLayout>
  );
}

function TrustItem({ icon, title }: { icon: React.ReactNode; title: string }) { return <div className="product-card-hover flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg bg-brand-light/45 px-1 py-1.5 text-center text-[8px] font-extrabold leading-tight text-brand-dark sm:text-[9px]"><span className="text-brand-dark [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{title}</div>; }
function isUuid(v: unknown) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
