import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { ShieldCheck, Truck, Headphones, ArrowRight, Sparkles } from "lucide-react";
import { fallbackBanners, fallbackCategories, fallbackProducts } from "@/lib/fallback-shop";
import { getHomeData, type HomeData } from "@/lib/home.functions";
import { toImg, imgSrcSet } from "@/lib/img";

const PROMO_BANNER_URL = "/__l5e/assets-v1/dcc4e046-2dc8-41c7-8c72-4e81d4ead269/banner-speaker.jpeg";
const promoBanner = { id: "banner-speaker", title: null as string | null, image_url: PROMO_BANNER_URL, link_url: "#", is_active: true, display_order: 0 };
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
  initialDataUpdatedAt: 0,
});

export const Route = createFileRoute("/")({
  head: () => {
    const firstBanner = PROMO_BANNER_URL;
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

  component: Home,
});

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-dark tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors group"
        >
          {action.label}
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const router = useRouter();
  const { data } = useQuery(homeQueryOptions);

  const banners = (data?.banners?.length ? [promoBanner, ...data.banners] : [promoBanner, ...fallbackBanners]) as HomeData["banners"];
  const categories = (data?.categories?.length ? data.categories : fallbackCategories) as HomeData["categories"];
  const featured = ((data?.products?.length ? data.products : (fallbackProducts.filter((p) => p.is_featured).slice(0, 8) as unknown as HomeData["products"])) as unknown) as Product[];

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
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!banners?.length || isPaused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners, isPaused]);

  return (
    <SiteLayout>
      {/* Hero banner */}
      {banners && banners.length > 0 && (
        <section className="bg-background">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div
              className="relative aspect-[16/7] sm:aspect-[21/8] lg:aspect-[21/7] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/10 ring-1 ring-black/5 group"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {banners.map((b, i) => (
                <a
                  key={b.id}
                  href={b.link_url || "#"}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === slide ? "opacity-100 z-10" : "opacity-0 z-0"}`}
                  aria-hidden={i !== slide}
                >
                  <img
                    src={b.image_url}
                    alt={b.title || "Banner"}
                    width={1600}
                    height={600}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding={i === 0 ? "sync" : "async"}
                    {...(i === 0 ? { fetchPriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement> : {})}
                  />
                  {b.title && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  )}
                </a>
              ))}

              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-10" />

              {banners.length > 1 && (
                <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      aria-label={`Slide ${i + 1}`}
                      aria-current={i === slide}
                      className={`h-2 rounded-full transition-all duration-300 ${i === slide ? "w-7 bg-white shadow-md" : "w-2 bg-white/70 hover:bg-white"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Popular Categories */}
      <section className="py-10 sm:py-14 bg-gradient-to-b from-brand-light/25 via-transparent to-transparent">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle
            title="পপুলার ক্যাটেগরি"
            subtitle="আপনার প্রিয় ফল, ফুল ও সবজির বীজ এখন এক ক্লিকে"
          />
        </div>

        <div
          className="marquee-pause overflow-hidden relative"
          style={{
            maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          }}
        >
          <div className="flex gap-4 sm:gap-6 w-max animate-marquee py-2">
            {[...categories, ...categories, ...categories].map((c, idx) => (
              <Link
                key={`${c.id}-${idx}`}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group text-center shrink-0 w-28 sm:w-36"
              >
                <div className="aspect-square rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 mb-3 bg-card ring-1 ring-black/5 group-hover:-translate-y-1 group-hover:ring-brand/20">
                  {c.image_url ? (
                    <img
                      src={toImg(c.image_url, { w: 288, q: 75 })}
                      srcSet={imgSrcSet(c.image_url, [144, 220, 288])}
                      sizes="(max-width: 640px) 112px, 144px"
                      alt={c.name}
                      width={144}
                      height={144}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl bg-brand-light">🌱</div>
                  )}
                </div>
                <div className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-brand transition-colors line-clamp-2 px-1">
                  {c.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products */}
      <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <SectionTitle
          title="পপুলার পণ্য"
          subtitle="গ্রাহকদের সবচেয়ে বেশি পছন্দ হওয়া বীজ ও গার্ডেন টুলস"
          action={{ label: "সকল পণ্য দেখুন", to: "/shop" }}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {featured?.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Why us */}
      <section className="container mx-auto px-3 sm:px-4 py-10 sm:py-14">
        <div className="text-center mb-8 sm:mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light/50 text-brand text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            কেন আমরা আলাদা
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-dark tracking-tight">
            আমাদের বিশেষ সুবিধা
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-5xl mx-auto">
          {[
            {
              icon: ShieldCheck,
              t: "অরিজিনাল বীজ",
              s: "পরীক্ষিত ও উচ্চ অংকুরোদগম হার নিশ্চিত। প্রতিটি পণ্য গুণগত মান যাচাই করে পাঠানো হয়।",
              gradient: "from-emerald-500 to-teal-600",
              light: "bg-emerald-50",
            },
            {
              icon: Truck,
              t: "দ্রুত ডেলিভারি",
              s: "সারা বাংলাদেশে নিরাপদ প্যাকেজিং ও দ্রুত পৌঁছে যায়। ক্যাশ অন ডেলিভারি সুবিধা।",
              gradient: "from-blue-500 to-indigo-600",
              light: "bg-blue-50",
            },
            {
              icon: Headphones,
              t: "কৃষি পরামর্শ",
              s: "অভিজ্ঞ কৃষিবিদদের কাছ থেকে বপন, পরিচর্যা ও রোগবালাই নিয়ে সরাসরি পরামর্শ।",
              gradient: "from-amber-500 to-orange-600",
              light: "bg-amber-50",
            },
          ].map(({ icon: Icon, t, s, gradient, light }) => (
            <div
              key={t}
              className={`${light} relative rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-center border border-black/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300`}
            >
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 rounded-b-full bg-gradient-to-r ${gradient}`} />
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gradient-to-br ${gradient} text-white shadow-lg shadow-black/10`}>
                <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div className="font-bold text-base sm:text-lg mb-2 text-foreground">{t}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{s}</div>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
