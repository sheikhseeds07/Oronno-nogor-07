import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { ShieldCheck, Truck, Headphones, ArrowRight, Sparkles } from "lucide-react";
import { fallbackCategories, fallbackProducts } from "@/lib/fallback-shop";
import { getHomeData, type HomeData } from "@/lib/home.functions";
import { toImg, imgSrcSet } from "@/lib/img";

type HeroCopy = { eyebrow: string; heading: string; sub: string; cta: string };

const HERO_COPY: Record<string, HeroCopy> = {
  "hero-seeds": {
    eyebrow: "১০০% অরিজিনাল বীজ",
    heading: "প্রিমিয়াম বীজের\nবিশাল সংগ্রহ",
    sub: "সবজি, ফল ও ফুলের পরীক্ষিত বীজ — উচ্চ অংকুরোদগম হারের নিশ্চয়তা।",
    cta: "বীজ কিনুন",
  },
  "hero-tools": {
    eyebrow: "টেকসই কৃষি সরঞ্জাম",
    heading: "কৃষি ও গার্ডেন\nটুলস",
    sub: "বাগান পরিচর্যার সব প্রয়োজনীয় হাতিয়ার — মজবুত, ধারালো ও দীর্ঘস্থায়ী।",
    cta: "টুলস দেখুন",
  },
  "hero-fertilizer": {
    eyebrow: "নিরাপদ ও কার্যকর",
    heading: "সার ও\nকীটনাশক",
    sub: "গাছের পুষ্টি ও রোগবালাই দমনে বিশ্বস্ত সমাধান, সঠিক ব্যবহারবিধি সহ।",
    cta: "অর্ডার করুন",
  },
};

const HERO_BANNERS = [
  { id: "hero-seeds", title: "প্রিমিয়াম বীজ — সবজি, ফল ও ফুল", image_url: "/banner-seeds.jpg", link_url: "/shop", is_active: true, display_order: 1 },
  { id: "hero-tools", title: "কৃষি ও গার্ডেন টুলস", image_url: "/banner-tools.jpg", link_url: "/shop", is_active: true, display_order: 2 },
  { id: "hero-fertilizer", title: "সার ও কীটনাশক", image_url: "/banner-fertilizer.jpg", link_url: "/shop", is_active: true, display_order: 3 },
] as unknown as HomeData["banners"];


const PROMO_BANNER_URL = "/banner-seeds.jpg";
const FALLBACK_HOME: HomeData = {
  banners: HERO_BANNERS,
  categories: fallbackCategories as unknown as HomeData["categories"],
  products: (fallbackProducts.filter((p) => p.is_featured).slice(0, 8)) as unknown as HomeData["products"],
};


const homeQueryOptions = queryOptions({
  queryKey: ["home-data"],
  queryFn: () => getHomeData(),
  staleTime: 5 * 60_000,
  initialData: { ...FALLBACK_HOME, categories: [] },
  initialDataUpdatedAt: 0,
});

export const Route = createFileRoute("/")({
  head: () => {
    const firstBanner = PROMO_BANNER_URL;
    return {
      meta: [
        { title: "অরন্য নগর (Oronno Nogor) — অরিজিনাল বীজ, গার্ডেন টুলস ও সার" },
        { name: "description", content: "অরন্য নগর — ছাদ বাগানির বিশ্বস্ত সঙ্গী। ১০০% অরিজিনাল সবজি, ফল ও ফুলের বীজ, গার্ডেন টুলস, সার ও কীটনাশক অনলাইনে অর্ডার করুন। সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।" },
        { name: "keywords", content: "অরন্য নগর, oronno nogor, oronnonogor, বীজ, সবজির বীজ, ফুলের বীজ, গার্ডেন টুলস, সার, কীটনাশক, ছাদ বাগান" },
        { property: "og:title", content: "অরন্য নগর (Oronno Nogor) — অরিজিনাল বীজ, গার্ডেন টুলস ও সার" },
        { property: "og:description", content: "ছাদ বাগানির বিশ্বস্ত সঙ্গী — ১০০% অরিজিনাল বীজ, গার্ডেন টুলস ও সার। সারাদেশে ক্যাশ অন ডেলিভারি।" },
        { property: "og:url", content: "https://oronnonogor.com/" },
        { property: "og:image", content: "https://oronnonogor.com/og-oronno-nogor.jpg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: "https://oronnonogor.com/og-oronno-nogor.jpg" },
      ],
      links: [
        { rel: "canonical", href: "https://oronnonogor.com/" },
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

  const banners = (data?.banners?.length ? data.banners : HERO_BANNERS) as HomeData["banners"];
  const categories = (data?.categories ?? []) as HomeData["categories"];
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
              {banners.map((b, i) => {
                const copy = HERO_COPY[b.id as string];
                return (
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
                  <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-center">
                    <div className="pl-6 sm:pl-12 lg:pl-20 pr-4 w-full max-w-[72%] sm:max-w-[58%] lg:max-w-[52%] py-2">
                      {copy ? (
                        <>
                          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] sm:text-xs font-semibold tracking-wide text-white/95 ring-1 ring-white/25">
                            <Sparkles className="w-3 h-3" />
                            {copy.eyebrow}
                          </span>
                          <h2 className="mt-0 sm:mt-3 whitespace-pre-line font-extrabold leading-[1.2] tracking-tight text-white text-[15px] sm:text-2xl lg:text-[2.5rem] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                            {copy.heading}
                          </h2>
                          <p className="hidden sm:block mt-2 text-xs lg:text-sm text-white/85 leading-relaxed max-w-sm">
                            {copy.sub}
                          </p>
                          <span className="mt-2 sm:mt-4 inline-flex items-center gap-1.5 rounded-full bg-white text-brand-dark px-3.5 sm:px-5 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-bold whitespace-nowrap shadow-lg shadow-black/20 transition-transform group-hover:translate-x-0.5">
                            {copy.cta}
                            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </span>
                        </>
                      ) : (
                        b.title && (
                          <h2 className="font-extrabold leading-tight tracking-tight text-white text-lg sm:text-3xl lg:text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
                            {b.title}
                          </h2>
                        )
                      )}
                    </div>
                  </div>
                </a>
                );
              })}


              {banners.length > 1 && (
                <div className="absolute bottom-3 sm:bottom-5 right-4 sm:right-6 flex items-center gap-2 z-20">
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
            {(categories.length < 6 ? [...categories, ...categories, ...categories, ...categories, ...categories, ...categories] : [...categories, ...categories, ...categories]).map((c, idx) => (
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
      <section className="py-12 sm:py-16 bg-gradient-to-b from-transparent via-brand-light/20 to-transparent">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-light/60 text-brand-dark text-[11px] sm:text-xs font-bold tracking-wide ring-1 ring-brand/15">
              <Sparkles className="w-3.5 h-3.5" />
              কেন আমরা আলাদা
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-dark tracking-tight">
              আমাদের বিশেষ সুবিধা
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
              ছাদ বাগান থেকে বাণিজ্যিক চাষ — প্রতিটি ধাপে আমরা পাশে আছি।
            </p>
            <span className="mt-5 mx-auto block h-1 w-16 rounded-full bg-gradient-to-r from-brand to-brand-dark" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: ShieldCheck,
                t: "অরিজিনাল বীজ",
                s: "পরীক্ষিত ও উচ্চ অংকুরোদগম হার নিশ্চিত। প্রতিটি পণ্য গুণগত মান যাচাই করে পাঠানো হয়।",
                n: "০১",
              },
              {
                icon: Truck,
                t: "দ্রুত ডেলিভারি",
                s: "সারা বাংলাদেশে নিরাপদ প্যাকেজিং ও দ্রুত পৌঁছে যায়। ক্যাশ অন ডেলিভারি সুবিধা।",
                n: "০২",
              },
              {
                icon: Headphones,
                t: "কৃষি পরামর্শ",
                s: "অভিজ্ঞ কৃষিবিদদের কাছ থেকে বপন, পরিচর্যা ও রোগবালাই নিয়ে সরাসরি পরামর্শ।",
                n: "০৩",
              },
            ].map(({ icon: Icon, t, s, n }) => (
              <div
                key={t}
                className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-brand/30 transition-all duration-300 p-5 sm:p-7"
              >
                <span className="pointer-events-none absolute -top-6 -right-3 text-6xl sm:text-7xl font-black text-brand/5 select-none">
                  {n}
                </span>
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-brand-dark scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-4 bg-brand-light/70 text-brand-dark ring-1 ring-brand/15 group-hover:bg-brand group-hover:text-primary-foreground transition-colors duration-300">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="font-bold text-base sm:text-lg mb-1.5 text-foreground">{t}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}