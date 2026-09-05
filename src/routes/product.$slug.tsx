import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { BrandLoader } from "@/components/layout/BrandLoader";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { supabase } from "@/lib/personal-supabase/client";
import { taka, bnDigits } from "@/lib/format";
import { useCart } from "@/lib/cart-store";
import { Minus, Plus, ShoppingCart, Zap, ShieldCheck, Truck } from "lucide-react";
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

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name,slug)").eq("slug", slug).maybeSingle();
      if (data) return data;
      // Fallback catalog is large; load it only when the database returns nothing.
      const { fallbackProducts } = await import("@/lib/fallback-shop");
      return fallbackProducts.find((item) => item.slug === slug) ?? null;
    },
  });

  const price = p ? (p.sale_price ?? p.price) : 0;
  const images: string[] = p?.images?.length ? p.images : ["/placeholder.svg"];
  const imagesKey = images.join(",");

  // NOTE: all hooks must run before any early return (React rules of hooks).
  useEffect(() => {
    if (!p) return;
    trackViewContent({ id: p.id, name: p.name, price });
  }, [p?.id, p?.name, price]);

  // Inject Product JSON-LD for SEO
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

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6">
        <nav className="text-xs text-muted-foreground mb-4">
          <Link to="/">হোম</Link> / <Link to="/shop">শপ</Link> / <span>{p.name}</span>
        </nav>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="aspect-square bg-white border rounded-xl overflow-hidden">
              <img
                src={toImg(images[activeImg], { w: 800, q: 80 })}
                srcSet={imgSrcSet(images[activeImg], [400, 600, 800, 1000])}
                sizes="(max-width: 768px) 100vw, 500px"
                alt={p.name}
                width={800}
                height={800}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2 mt-3">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`aspect-square border-2 rounded-lg overflow-hidden ${i === activeImg ? "border-brand" : "border-transparent"}`}>
                    <img src={toImg(src, { w: 160, q: 70 })} alt="" width={80} height={80} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {"sku" in p && p.sku && <div className="text-xs text-muted-foreground mt-1">SKU: {String(p.sku)}</div>}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-brand-dark">{taka(price)}</span>
              {p.sale_price && <span className="text-lg text-muted-foreground line-through">{taka(p.price)}</span>}
            </div>
            {p.short_description && <p className="mt-3 text-muted-foreground">{p.short_description}</p>}

            <div className="mt-5 flex items-center gap-3">
              <span className="text-sm font-semibold">পরিমাণ:</span>
              <div className="flex items-center border rounded-lg">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2"><Minus className="w-4 h-4" /></button>
                <span className="px-4 font-bold">{bnDigits(qty)}</span>
                <button onClick={() => setQty(Math.min(p.stock, qty + 1))} className="px-3 py-2"><Plus className="w-4 h-4" /></button>
              </div>
              <span className="text-sm text-muted-foreground">স্টক: {bnDigits(p.stock)}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={addToCart} disabled={p.stock <= 0} className="bg-white border-2 border-brand text-brand-dark py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-brand-light disabled:opacity-50">
                <ShoppingCart className="w-5 h-5" /> কার্টে যোগ করুন
              </button>
              <button onClick={buyNow} disabled={p.stock <= 0} className="bg-brand text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-brand-dark disabled:opacity-50">
                <Zap className="w-5 h-5" /> এখনই অর্ডার
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-brand-light rounded-lg p-2 flex items-center gap-2"><Truck className="w-4 h-4 text-brand-dark" /> হোম ডেলিভারি</div>
              <div className="bg-brand-light rounded-lg p-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-dark" /> ১০০% অরিজিনাল</div>
              <div className="bg-brand-light rounded-lg p-2 flex items-center gap-2">💵 ক্যাশ অন ডেলিভারি</div>
            </div>


          </div>
        </div>

        {isUuid(p.id) ? (
          <ProductTabs productId={String(p.id)} description={p.description} />
        ) : (
          p.description && (
            <div className="mt-8">
              <h3 className="font-bold mb-2">বিবরণ</h3>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-muted-foreground">{p.description}</div>
            </div>
          )
        )}
      </div>
    </SiteLayout>
  );
}

function isUuid(v: unknown) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
