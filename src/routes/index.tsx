import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { ShieldCheck, Truck, Headphones, ArrowRight } from "lucide-react";
import { fallbackBanners, fallbackCategories, fallbackProducts } from "@/lib/fallback-shop";
import { getHomeData, type HomeData } from "@/lib/home.functions";
import { toImg, imgSrcSet } from "@/lib/img";

const FALLBACK_HOME: HomeData = {
  banners: fallbackBanners as unknown as HomeData["banners"],
  categories: fallbackCategories as unknown as HomeData["categories"],
  products: (fallbackProducts.filter((p) => p.is_featured).slice(0, 8)) as unknown as HomeData["products"],
};

const homeQueryOptions = queryOptions({
  queryKey: ["home-data"],
  queryFn: () => getHomeData(),
  staleTime: 5 * 60_000,
  initialData: FALLBACK_HOME,
  initialDataUpdatedAt: 0, // treat as stale so fresh data fetches immediately in background
});

export const Route = createFileRoute("/")({
  head: () => {
    const firstBanner = fallbackBanners[0]?.image_url;
    return {
      meta: [
        { title: "শেখ সিড — অরিজিনাল বীজ ও গার্ডেন টুলস অনলাইন শপ" },
        { name: "description", content: "১০০% অরিজিনাল সবজি, ফল ও ফুলের বীজ, গার্ডেন টুলস ও সরঞ্জাম। সারাদেশে হোম ডেলিভারি, ক্যাশ অন ডেলিভারি সুবিধা।" },
        { property: "og:title", content: "শেখ সিড — অরিজিনাল বীজ ও গার্ডেন টুলস অনলাইন শপ" },
        { property: "og:description", content: "১০০% অরিজিনাল বীজ ও গার্ডেন টুলস। সারাদেশে হোম ডেলিভারি — ক্যাশ অন ডেলিভারি।" },
        { property: "og:url", content: "https://sheikhseeds.site/" },
        { property: "og:image", content: "https://sheikhseeds.site/favicon.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://sheikhseeds.site/favicon.png" },
      ],
      links: [
        { rel: "canonical", href: "https://sheikhseeds.site/" },
        ...(firstBanner ? [{ rel: "preload", as: "image", href: firstBanner }] : []),
      ],
    };
  },

  // No blocking loader — page renders instantly with fallback data; live data swaps in.
  component: Home,
});

function Home() {
  const router = useRouter();
  const { data } = useQuery(homeQueryOptions);

  const banners = (data?.banners?.length ? data.banners : fallbackBanners) as HomeData["banners"];
  const categories = (data?.categories?.length ? data.categories : fallbackCategories) as HomeData["categories"];
  const featured = ((data?.products?.length ? data.products : (fallbackProducts.filter((p) => p.is_featured).slice(0, 8) as unknown as HomeData["products"])) as unknown) as Product[];

  // Warm up the most-likely next routes in the background after first paint
  useEffect(() => {
    const idle = (cb: () => void) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
      if (ric) ric(cb); else setTimeout(cb, 800);
    };
    idle(() => {
      router.preloadRoute({ to: "/shop" }).catch(() => {});
      router.preloadRoute({ to: "/checkout" }).catch(() => {});
      router.preloadRoute({ to: "/cart" }).catch(() => {});
    });
  }, [router]);

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (!banners?.length) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners]);

  return (
    <SiteLayout>
      {/* Hero banner */}
      {banners && banners.length > 0 && (
        <section className="bg-card">
          <div className="container mx-auto px-3 py-3">
            <div className="relative aspect-[16/7] sm:aspect-[21/8] rounded-2xl overflow-hidden">
              {banners.map((b, i) => (
                <a
                  key={b.id}
                  href={b.link_url || "#"}
                  className={`absolute inset-0 transition-opacity duration-700 ${i === slide ? "opacity-100" : "opacity-0"}`}
                >
                  <img
                    src={b.image_url}
                    alt={b.title || ""}
                    width={1600}
                    height={600}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding={i === 0 ? "sync" : "async"}
                    {...(i === 0 ? { fetchPriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement> : {})}
                  />
                </a>
              ))}
              {banners.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} className={`w-2 h-2 rounded-full transition-all ${i === slide ? "bg-card w-6" : "bg-card/60"}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Popular Categories — single-line auto scroll */}
      <section className="py-8 bg-gradient-to-b from-brand-light/30 to-transparent">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-brand-dark mb-1">পপুলার ক্যাটেগরি</h2>

        <div className="marquee-pause overflow-hidden relative" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
          <div className="flex gap-4 sm:gap-6 w-max animate-marquee">
            {[...categories, ...categories, ...categories].map((c, idx) => (
              <Link
                key={`${c.id}-${idx}`}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group text-center shrink-0 w-28 sm:w-36"
              >
                <div className="aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition mb-2 bg-card ring-1 ring-black/5">
                  {c.image_url ? (
                    <img src={toImg(c.image_url, { w: 288, q: 75 })} srcSet={imgSrcSet(c.image_url, [144, 220, 288])} sizes="(max-width: 640px) 112px, 144px" alt={c.name} width={144} height={144} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl bg-brand-light">🌱</div>
                  )}
                </div>
                <div className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-brand line-clamp-2 px-1">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products */}
      <section className="container mx-auto px-3 py-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-brand-dark mb-6">পপুলার পণ্য</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {featured?.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        <div className="text-center mt-6">
          <Link to="/shop" className="inline-flex items-center gap-2 text-brand font-bold hover:underline">
            সকল পণ্য দেখুন <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Why us — 3 colored cards */}
      <section className="container mx-auto px-3 py-10">
        <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-4xl mx-auto">
          {[
            { icon: ShieldCheck, t: "অরিজিনাল বীজ", s: "পরীক্ষিত ও উচ্চ অংকুরোদগম হার নিশ্চিত।", bg: "bg-emerald-50", ic: "bg-emerald-100 text-emerald-600" },
            { icon: Truck, t: "দ্রুত ডেলিভারি", s: "সারা বাংলাদেশে নিরাপদ ও দ্রুত পৌঁছে যায়।", bg: "bg-blue-50", ic: "bg-blue-100 text-blue-600" },
            { icon: Headphones, t: "কৃষি পরামর্শ", s: "অভিজ্ঞ কৃষিবিদদের কাছ থেকে সরাসরি পরামর্শ।", bg: "bg-amber-50", ic: "bg-amber-100 text-amber-600" },
          ].map(({ icon: Icon, t, s, bg, ic }) => (
            <div key={t} className={`${bg} border border-black/5 rounded-2xl p-4 sm:p-6 text-center`}>
              <div className={`${ic} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="font-bold text-sm sm:text-base mb-1.5">{t}</div>
              <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s}</div>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
