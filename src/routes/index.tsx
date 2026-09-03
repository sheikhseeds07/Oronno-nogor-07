import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { ShieldCheck, Truck, Headphones, ArrowRight, Sparkles } from "lucide-react";
import { getHomeData, type HomeData } from "@/lib/home.functions";
import { toImg, imgSrcSet } from "@/lib/img";

type HeroCopy = { eyebrow: string; heading: string; sub: string; cta: string };

const HERO_COPY: Record<string, HeroCopy> = {
  "hero-seeds": { eyebrow: "১০০% অরিজিনাল বীজ", heading: "প্রিমিয়াম বীজের\nবিশাল সংগ্রহ", sub: "সবজি, ফল ও ফুলের পরীক্ষিত বীজ — উচ্চ অংকুরোদগম হারের নিশ্চয়তা।", cta: "বীজ কিনুন" },
  "hero-tools": { eyebrow: "টেকসই কৃষি সরঞ্জাম", heading: "কৃষি ও গার্ডেন\nটুলস", sub: "বাগান পরিচর্যার সব প্রয়োজনীয় হাতিয়ার — মজবুত, ধারালো ও দীর্ঘস্থায়ী।", cta: "টুলস দেখুন" },
  "hero-fertilizer": { eyebrow: "নিরাপদ ও কার্যকর", heading: "সার ও\nকীটনাশক", sub: "গাছের পুষ্টি ও রোগবালাই দমনে বিশ্বস্ত সমাধান, সঠিক ব্যবহারবিধি সহ।", cta: "অর্ডার করুন" },
};

const HERO_BANNERS = [
  { id: "hero-seeds", title: "প্রিমিয়াম বীজ — সবজি, ফল ও ফুল", image_url: "/banner-seeds.jpg", link_url: "/shop", is_active: true, display_order: 1 },
  { id: "hero-tools", title: "কৃষি ও গার্ডেন টুলস", image_url: "/banner-tools.jpg", link_url: "/shop", is_active: true, display_order: 2 },
  { id: "hero-fertilizer", title: "সার ও কীটনাশক", image_url: "/banner-fertilizer.jpg", link_url: "/shop", is_active: true, display_order: 3 },
] as unknown as HomeData["banners"];

const FALLBACK_HOME: HomeData = { banners: HERO_BANNERS, categories: [], subcategories: [], products: [] };
const HOME_CACHE_KEY = "oronno-home-data-v3";

function getCachedHomeData(): HomeData {
  if (typeof window === "undefined") return FALLBACK_HOME;
  try {
    const raw = window.localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return FALLBACK_HOME;
    const parsed = JSON.parse(raw) as Partial<HomeData>;
    return {
      banners: Array.isArray(parsed.banners) && parsed.banners.length ? parsed.banners : HERO_BANNERS,
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
    };
  } catch {
    return FALLBACK_HOME;
  }
}

const homeQueryOptions = queryOptions({
  queryKey: ["home-data-v1"],
  queryFn: getHomeData,
  enabled: typeof window !== "undefined",
  placeholderData: getCachedHomeData,
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; to: string } }) {
  return (
    <div className="mb-3.5 flex items-end justify-between gap-3 sm:mb-5">
      <div className={`min-w-0 ${!action ? "mx-auto text-center" : ""}`}>
        <h2 className="text-lg font-extrabold tracking-tight text-brand-dark sm:text-2xl lg:text-3xl">{title}</h2>
        {subtitle && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{subtitle}</p>}
      </div>
      {action && (
        <Link to={action.to} className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-brand/15 bg-brand-light/40 px-2.5 py-1.5 text-[11px] font-bold text-brand-dark transition-all hover:border-brand/30 hover:bg-brand-light sm:px-3 sm:text-xs">
          {action.label}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const { data: home = FALLBACK_HOME, isPlaceholderData } = useQuery(homeQueryOptions);
  const banners = (home.banners.length ? home.banners : HERO_BANNERS) as HomeData["banners"];
  const categories = home.categories;
  const popularProducts = home.products as unknown as Product[];

  useEffect(() => {
    if (isPlaceholderData) return;
    try {
      window.localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(home));
    } catch {
      // Ignore storage quota/private-mode errors; live Supabase data still works.
    }
  }, [home, isPlaceholderData]);

  const [slide, setSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  useEffect(() => {
    if (!banners?.length || isPaused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners, isPaused]);

  const marqueeCategories = useMemo(() => {
    if (!categories.length) return [] as HomeData["categories"];
    const repeatCount = categories.length < 5 ? Math.max(3, Math.ceil(12 / categories.length)) : 2;
    return Array.from({ length: repeatCount }, () => categories).flat();
  }, [categories]);

  return (
    <SiteLayout>
      <style>{`@keyframes homeCategoryMarquee { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }`}</style>

      {banners && banners.length > 0 && (
        <section className="bg-background">
          <div className="container mx-auto px-3 pt-2.5 sm:px-4 sm:pt-4">
            <div
              className="group relative aspect-[16/7] overflow-hidden rounded-2xl bg-muted shadow-lg shadow-black/8 ring-1 ring-black/5 sm:aspect-[21/8] sm:rounded-3xl lg:aspect-[21/7]"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {banners.map((b, i) => {
                const copy = HERO_COPY[b.id as string];
                return (
                  <a key={b.id} href={b.link_url || "#"} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === slide ? "z-10 opacity-100" : "z-0 opacity-0"}`} aria-hidden={i !== slide}>
                    <img
                      src={toImg(b.image_url, { w: 1280, q: 74 })}
                      alt={b.title || "Banner"}
                      width={1600}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-[5000ms] ease-out group-hover:scale-[1.025]"
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding={i === 0 ? "sync" : "async"}
                      {...(i === 0 ? ({ fetchPriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/45 to-black/5" />
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full max-w-[74%] px-5 sm:max-w-[60%] sm:px-10 lg:max-w-[52%] lg:px-16">
                        {copy ? (
                          <>
                            <span className="hidden items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white ring-1 ring-white/20 backdrop-blur-md sm:inline-flex sm:text-xs">
                              <Sparkles className="h-3 w-3" />{copy.eyebrow}
                            </span>
                            <h2 className="whitespace-pre-line text-[17px] font-extrabold leading-[1.14] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:mt-2 sm:text-3xl lg:text-[2.7rem]">{copy.heading}</h2>
                            <p className="mt-1.5 hidden max-w-sm text-xs leading-relaxed text-white/85 sm:block lg:text-sm">{copy.sub}</p>
                            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-extrabold text-brand-dark shadow-lg shadow-black/20 transition-transform group-hover:translate-x-0.5 sm:mt-4 sm:px-4 sm:py-2 sm:text-xs">
                              {copy.cta}<ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </>
                        ) : b.title ? (
                          <h2 className="text-lg font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-3xl lg:text-4xl">{b.title}</h2>
                        ) : null}
                      </div>
                    </div>
                  </a>
                );
              })}
              {banners.length > 1 && (
                <div className="absolute bottom-2.5 right-3.5 z-20 flex items-center gap-1.5 sm:bottom-4 sm:right-5 sm:gap-2">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} aria-current={i === slide} className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? "w-6 bg-white shadow-md" : "w-1.5 bg-white/65 hover:bg-white"}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden py-4 sm:py-7">
        <div className="container mx-auto px-3 text-center sm:px-4">
          <SectionTitle title="পপুলার ক্যাটেগরি" />
        </div>
        <div className="px-3 sm:px-4">
          {categories.length > 0 && (
            <div className="relative mx-auto max-w-7xl overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-7 bg-gradient-to-r from-background to-transparent sm:w-12" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-gradient-to-l from-background to-transparent sm:w-12" />
              <div className="flex w-max gap-2.5 py-0.5 sm:gap-3 sm:py-1" style={{ animation: categories.length > 1 ? "homeCategoryMarquee 30s linear infinite" : "none" }}>
                {marqueeCategories.map((category, index) => (
                  <Link key={`${category.id}-${index}`} to="/category/$slug" params={{ slug: category.slug }} className="group w-[104px] shrink-0 rounded-xl border border-border/60 bg-card p-1.5 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md sm:w-[132px] sm:rounded-2xl sm:p-2">
                    <div className="mb-1.5 aspect-square overflow-hidden rounded-lg bg-brand-light/30 ring-1 ring-black/5 sm:mb-2 sm:rounded-xl">
                      {category.image_url ? (
                        <img src={toImg(category.image_url, { w: 264, q: 75 })} srcSet={imgSrcSet(category.image_url, [132, 198, 264])} sizes="(max-width: 640px) 104px, 132px" alt={category.name} width={132} height={132} loading="eager" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl">🌱</div>
                      )}
                    </div>
                    <div className="line-clamp-2 px-0.5 text-[11px] font-bold leading-tight text-foreground transition-colors group-hover:text-brand-dark sm:text-xs">{category.name}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-3 py-2.5 sm:px-4 sm:py-7">
        <SectionTitle title="পপুলার পণ্য" subtitle="বর্তমান সময়ে সবচেয়ে চাহিদা সম্পন্ন পন্য গুলো" action={{ label: "সকল পণ্য দেখুন", to: "/shop" }} />
        {popularProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4 lg:gap-4">{popularProducts.map((product) => <ProductCard key={product.id} p={product} />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-5 py-8 text-center text-sm text-muted-foreground">এখনো কোনো পণ্য পপুলার হিসেবে যোগ করা হয়নি।</div>
        )}
      </section>

      <section className="py-7 sm:py-10">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="mb-5 text-center sm:mb-7">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-light/60 px-2.5 py-1 text-[10px] font-bold tracking-wide text-brand-dark ring-1 ring-brand/10 sm:text-xs"><Sparkles className="h-3 w-3" />কেন আমরা আলাদা</span>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-brand-dark sm:text-2xl lg:text-3xl">আমাদের বিশেষ সুবিধা</h2>
            <p className="mx-auto mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">ছাদ বাগান থেকে বাণিজ্যিক চাষ — প্রতিটি ধাপে আমরা পাশে আছি।</p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {[
              { icon: ShieldCheck, t: "অরিজিনাল বীজ", s: "পরীক্ষিত ও উচ্চ অংকুরোদগম হার নিশ্চিত। প্রতিটি পণ্য গুণগত মান যাচাই করে পাঠানো হয়।", n: "০১" },
              { icon: Truck, t: "দ্রুত ডেলিভারি", s: "সারা বাংলাদেশে নিরাপদ প্যাকেজিং ও দ্রুত পৌঁছে যায়। ক্যাশ অন ডেলিভারি সুবিধা।", n: "০২" },
              { icon: Headphones, t: "কৃষি পরামর্শ", s: "অভিজ্ঞ কৃষিবিদদের কাছ থেকে বপন, পরিচর্যা ও রোগবালাই নিয়ে সরাসরি পরামর্শ।", n: "০৩" },
            ].map(({ icon: Icon, t, s, n }) => (
              <div key={t} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-lg sm:p-5">
                <span className="pointer-events-none absolute -right-1 -top-4 select-none text-6xl font-black text-brand/5">{n}</span>
                <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand to-brand-dark transition-transform duration-500 group-hover:scale-x-100" />
                <div className="relative flex items-start gap-3 sm:block">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light/70 text-brand-dark ring-1 ring-brand/10 transition-colors duration-300 group-hover:bg-brand group-hover:text-primary-foreground sm:mb-3 sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                  </div>
                  <div><div className="mb-0.5 text-sm font-bold text-foreground sm:text-base">{t}</div><div className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{s}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions),
  component: Home,
});
