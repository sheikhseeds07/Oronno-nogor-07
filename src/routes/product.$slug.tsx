import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { Minus, Plus, ShoppingCart, Zap, ShieldCheck, Truck, BadgeCheck, PackageCheck, ChevronLeft, Share2, Copy, Check, Sparkles } from "lucide-react";
import { toastAddedToCart } from "@/lib/cart-toast";
import { trackAddToCart, trackViewContent } from "@/lib/fbq";
import { toImg, imgSrcSet } from "@/lib/img";
import { ProductTabs } from "@/components/community/ProductTabs";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
});

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
    queryKey: ["related-products", p?.id, p?.category_id],
    enabled: !!p,
    queryFn: async () => {
      if (!p) return [] as Product[];
      let query = supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).neq("id", p.id);
      if (p.category_id) query = query.eq("category_id", p.category_id);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  useEffect(() => {
    if (!p) return;
    trackViewContent({ id: p.id, name: p.name, price });
  }, [p?.id, p?.name, price]);

  useEffect(() => {
    if (!p) return;
    const ld = {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: p.name,
      image: images,
      description: p.short_description || p.description || p.name,
      sku: (p as any).sku || p.id,
      offers: {
        "@type": "Offer",
        priceCurrency: "BDT",
        price: String(price),
        availability: (p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: typeof window !== "undefined" ? window.location.href : `https://sheikhseeds.com/product/${p.slug}`,
      },
    };
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.text = JSON.stringify(ld);
    tag.setAttribute("data-product-ld", p.id);
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [p?.id, p?.name, p?.slug, (p as any)?.sku, p?.stock, p?.short_description, p?.description, price, imagesKey]);

  if (isLoading) return <SiteLayout><div className="container mx-auto px-3 py-10"><BrandLoader /></div></SiteLayout>;
  if (!p) return <SiteLayout><div className="container mx-auto px-3 py-10 text-center">পণ্য পাওয়া যায়নি</div></SiteLayout>;

  const addToCart = () => {
    add({ id: p.id, name: p.name, slug: p.slug, price, image: images[0], stock: p.stock }, qty);
    trackAddToCart({ id: p.id, name: p.name, price, quantity: qty });
    toastAddedToCart(p.name);
  };

  const buyNow = () => {
    add({ id: p.id, name: p.name, slug: p.slug, price, image: images[0], stock: p.stock }, qty);
    trackAddToCart({ id: p.id, name: p.name, price, quantity: qty });
    navigate({ to: "/checkout" });
  };

  const shareProduct = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: "Sheikh Seeds-এর এই পণ্যটি দেখুন", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    } catch { /* user cancelled share */ }
  };

  return (
    <SiteLayout>
      <style>{`
        @keyframes productEntrance { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes productGlow { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.10)} 50%{box-shadow:0 0 0 7px rgba(22,163,74,0)} }
        @keyframes productBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        .product-entrance{animation:productEntrance .55s cubic-bezier(.22,1,.36,1) both}
        .product-glow{animation:productGlow 2.8s ease-in-out infinite}
        .product-badge{animation:productBadge 2.5s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.product-entrance,.product-glow,.product-badge{animation:none!important}}
      `}</style>

      <main className="container mx-auto max-w-6xl px-2.5 pb-8 pt-2.5 sm:px-4 sm:pb-12 sm:pt-5">
        <div className="mb-2 flex items-center justify-between sm:mb-4">
          <Link to="/shop" className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-bold text-muted-foreground transition hover:bg-brand-light hover:text-brand-dark">
            <ChevronLeft className="h-4 w-4" /> শপে ফিরে যান
          </Link>
          <button onClick={shareProduct} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground shadow-sm transition hover:border-brand/30 hover:text-brand active:scale-90" aria-label="পণ্য শেয়ার করুন">
            {copied ? <Check className="h-4 w-4 text-brand" /> : <Share2 className="h-4 w-4" />}
          </button>
        </div>

        <nav className="mb-3 hidden text-[11px] text-muted-foreground sm:block">
          <Link to="/">হোম</Link><span className="mx-1.5">/</span><Link to="/shop">সকল পণ্য</Link><span className="mx-1.5">/</span><span className="text-foreground">{p.name}</span>
        </nav>

        <section className="product-entrance grid overflow-hidden rounded-[22px] border border-brand/10 bg-white shadow-[0_16px_50px_-30px_rgba(20,83,45,.55)] md:grid-cols-[1.02fr_.98fr]">
          <div className="bg-gradient-to-b from-brand-light/25 to-white p-2.5 sm:p-4 md:p-5">
            <div className="relative aspect-square overflow-hidden rounded-[18px] border border-black/5 bg-white shadow-inner">
              <img src={toImg(images[activeImg], { w: 1000, q: 84 })} srcSet={imgSrcSet(images[activeImg], [500, 800, 1000, 1200])} sizes="(max-width: 768px) 100vw, 540px" alt={p.name} width={1000} height={1000} fetchPriority="high" decoding="async" className="h-full w-full object-cover transition duration-500 hover:scale-[1.015]" />
              {discount > 0 && <span className="product-badge absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg"><Sparkles className="h-3 w-3" /> {bnDigits(discount)}% ছাড়</span>}
              {p.stock <= 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-base font-extrabold text-white backdrop-blur-[2px]">স্টক শেষ</span>}
            </div>
            {images.length > 1 && <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((src, i) => <button key={i} onClick={() => setActiveImg(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all active:scale-95 sm:h-[72px] sm:w-[72px] ${i === activeImg ? "border-brand shadow-md ring-2 ring-brand/10" : "border-transparent opacity-70 hover:opacity-100"}`}><img src={toImg(src, { w: 180, q: 72 })} alt="" width={80} height={80} loading="lazy" decoding="async" className="h-full w-full object-cover" /></button>)}
            </div>}
          </div>

          <div className="flex flex-col p-4 sm:p-6 md:p-7 lg:p-8">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {p.categories?.name && <span className="rounded-full bg-brand-light/65 px-2.5 py-1 text-[10px] font-extrabold text-brand-dark">{p.categories.name}</span>}
              {p.stock > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><BadgeCheck className="h-3 w-3" /> স্টকে আছে</span>}
            </div>
            <h1 className="text-[23px] font-extrabold leading-[1.3] tracking-[-.02em] text-foreground sm:text-3xl">{p.name}</h1>
            {"sku" in p && p.sku && <div className="mt-1.5 text-[10px] font-medium text-muted-foreground">SKU: {String(p.sku)}</div>}

            <div className="my-4 rounded-2xl bg-gradient-to-r from-brand-light/55 to-brand-light/20 p-3.5 sm:my-5 sm:p-4">
              <div className="flex items-end gap-2.5">
                <span className="text-[30px] font-black leading-none tracking-tight text-brand-dark sm:text-4xl">{taka(price)}</span>
                {oldPrice && <span className="mb-0.5 text-sm text-muted-foreground line-through sm:text-base">{taka(oldPrice)}</span>}
                {discount > 0 && <span className="mb-0.5 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-extrabold text-destructive">-{bnDigits(discount)}%</span>}
              </div>
              {oldPrice && <p className="mt-1.5 text-[10px] font-semibold text-brand-dark/70">আজকের বিশেষ মূল্য — সীমিত সময়ের অফার</p>}
            </div>

            {p.short_description && <p className="mb-4 text-[13px] leading-6 text-muted-foreground sm:text-sm">{p.short_description}</p>}

            <div className="mb-4 flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
              <span className="text-xs font-bold">পরিমাণ</span>
              <div className="flex items-center overflow-hidden rounded-lg border border-brand/25 bg-white shadow-sm">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-9 w-9 items-center justify-center text-brand transition hover:bg-brand-light active:scale-90" aria-label="পরিমাণ কমান"><Minus className="h-4 w-4" /></button>
                <span className="min-w-9 text-center text-sm font-extrabold text-brand-dark">{bnDigits(qty)}</span>
                <button onClick={() => setQty(Math.min(Math.max(1, p.stock), qty + 1))} disabled={p.stock <= 0 || qty >= p.stock} className="flex h-9 w-9 items-center justify-center text-brand transition hover:bg-brand-light disabled:opacity-35 active:scale-90" aria-label="পরিমাণ বাড়ান"><Plus className="h-4 w-4" /></button>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">স্টক: {bnDigits(Math.max(0, p.stock))}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={addToCart} disabled={p.stock <= 0} className="product-glow flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-brand bg-white px-2 text-xs font-extrabold text-brand-dark transition-all hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-45 active:scale-[.98] sm:text-sm"><ShoppingCart className="h-4.5 w-4.5" /> কার্টে যোগ করুন</button>
              <button onClick={buyNow} disabled={p.stock <= 0} className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-2 text-xs font-extrabold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-45 active:scale-[.98] sm:text-sm"><Zap className="h-4.5 w-4.5" /> এখনই অর্ডার</button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
              <TrustItem icon={<Truck />} title="হোম ডেলিভারি" />
              <TrustItem icon={<ShieldCheck />} title="১০০% অরিজিনাল" />
              <TrustItem icon={<PackageCheck />} title="ক্যাশ অন ডেলিভারি" />
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[20px] border border-brand/10 bg-white shadow-[0_10px_35px_-25px_rgba(20,83,45,.5)] sm:mt-6">
          {isUuid(p.id) ? <ProductTabs productId={String(p.id)} description={p.description} /> : p.description && <div className="p-4 sm:p-6"><h2 className="mb-3 text-lg font-extrabold text-brand-dark">পণ্যের বিবরণ</h2><div className="prose prose-sm max-w-none whitespace-pre-wrap leading-7 text-muted-foreground">{p.description}</div></div>}
        </section>

        {relatedProducts.length > 0 && <section className="mt-7 sm:mt-10">
          <div className="mb-3 flex items-end justify-between px-0.5 sm:mb-4">
            <div><p className="mb-0.5 text-[10px] font-bold uppercase tracking-[.15em] text-brand/65">You may also like</p><h2 className="text-xl font-extrabold tracking-tight text-brand-dark sm:text-2xl">আপনার জন্য সাজেশন</h2></div>
            <Link to="/shop" className="rounded-full bg-brand-light/60 px-3 py-1.5 text-[10px] font-extrabold text-brand-dark transition hover:bg-brand-light sm:text-xs">সব পণ্য দেখুন →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {relatedProducts.map((item, i) => <div key={item.id} className="product-entrance" style={{ animationDelay: `${i * 70}ms` }}><ProductCard p={item} /></div>)}
          </div>
        </section>}
      </main>
    </SiteLayout>
  );
}

function TrustItem({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl bg-brand-light/45 px-1.5 py-2 text-center text-[9px] font-extrabold leading-tight text-brand-dark sm:text-[10px]"><span className="text-brand-dark [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{title}</div>;
}

function isUuid(v: unknown) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
