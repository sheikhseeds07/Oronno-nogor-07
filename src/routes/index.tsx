import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { Truck, Headphones, ArrowRight, Sparkles, Sprout, Wallet, ShieldCheck, MapPin, BadgeCheck, Leaf } from "lucide-react";
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
  // Product price/popular status should refresh immediately after admin changes.
  staleTime: 60_000,
  gcTime: 30 * 60_000,
  retry: 1,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
});

function AnimatedStat({ value, suffix = "", label, icon: Icon }: { value: number; suffix?: string; label: string; icon: typeof Sprout }) {
  const [count, setCount] = useState(0);
  const statRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = statRef.current;
    if (!node) return;

    let raf = 0;
    let started = false;
    const duration = 1500;

    const animate = () => {
      if (started) return;
      started = true;
      const startTime = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(value * eased));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      animate();
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        animate();
        observer.disconnect();
      }
    }, { threshold: 0.05 });

    observer.observe(node);

    // Safety fallback: never leave the stat at ০ if the observer is unavailable
    // or the section is already visible during hydration.
    const fallback = window.setTimeout(() => animate(), 900);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <div ref={statRef} className="group relative overflow-hidden px-2 py-2.5 sm:px-4 sm:py-3.5">
      <div className="absolute inset-0 bg-gradient-to-b from-brand/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-light/80 text-brand-dark ring-1 ring-brand/15 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-brand group-hover:text-primary-foreground sm:h-9 sm:w-9">
        <Icon className="h-4 w-4" />
      </div>
      <div className="relative text-base font-black tracking-tight text-brand-dark tabular-nums sm:text-xl">{count.toLocaleString("bn-BD")}{suffix}</div>
      <div className="relative mt-0.5 text-[9.5px] font-medium text-muted-foreground sm:text-[11px]">{label}</div>
    </div>
  );
}
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
                        <img src={toImg(category.image_url, { w: 264, q: 75 })} srcSet={imgSrcSet(category.image_url, [132, 198, 264])} sizes="(max-width: 640px) 104px, 132px" alt={category.name} width={132} height={132} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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

      <section className="relative overflow-hidden py-5 sm:py-8">
        <style>{`
          @keyframes trustFloat { 0%,100% { transform: translate3d(0,0,0) rotate(0deg); } 50% { transform: translate3d(0,-7px,0) rotate(1deg); } }
          @keyframes trustPulse { 0%,100% { box-shadow: 0 0 0 0 hsl(var(--brand) / .10); } 50% { box-shadow: 0 0 0 9px hsl(var(--brand) / 0); } }
          @keyframes trustShimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
        `}</style>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--brand)/.09),transparent_28%),radial-gradient(circle_at_85%_80%,hsl(var(--brand)/.07),transparent_30%)]" />
        <div className="container relative mx-auto px-3 sm:px-4">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] border border-brand/15 bg-card/95 shadow-[0_14px_44px_hsl(var(--brand)/.10)] backdrop-blur sm:rounded-[2rem]">
            <div className="relative overflow-hidden px-3.5 pb-3.5 pt-4 sm:px-7 sm:pb-5 sm:pt-6">
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />
              <div className="relative mx-auto max-w-2xl text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand-light/60 px-3 py-1 text-[10px] font-extrabold tracking-wide text-brand-dark shadow-sm sm:text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5" />অরন্নো নগর — আপনার আস্থার ঠিকানা
                </div>
                <h2 className="mt-2 text-lg font-black tracking-tight text-brand-dark sm:text-3xl">ভালো বীজে শুরু, ভালো ফলনে আস্থা</h2>
                <p className="mx-auto mt-1 max-w-xl text-[10px] leading-relaxed text-muted-foreground sm:text-sm">অরিজিনাল পণ্য, নিরাপদ ডেলিভারি এবং বাগান করার প্রতিটি ধাপে প্রয়োজনীয় সহযোগিতা — সব একসাথে।</p>
              </div>
              <div className="relative mt-3.5 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-2.5">
                {[
                  { icon: Wallet, t: "হাতে পেয়ে মূল্য পরিশোধ", s: "পণ্য হাতে দেখে তারপর ক্যাশ অন ডেলিভারি।" },
                  { icon: Headphones, t: "ফ্রি পরামর্শ", s: "বপন ও পরিচর্যায় কৃষিবিদের দিকনির্দেশনা।" },
                  { icon: Truck, t: "নিরাপদ ডেলিভারি", s: "যত্নসহ প্যাকেজিংয়ে সারাদেশে পৌঁছে দিই।" },
                  { icon: BadgeCheck, t: "মানের প্রতি অঙ্গীকার", s: "বাছাইকৃত বীজ ও পণ্যে নির্ভরযোগ্যতার চেষ্টা।" },
                ].map(({ icon: Icon, t, s }, i) => (
                  <div key={t} className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/75 p-2.5 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:border-brand/30 hover:shadow-[0_14px_30px_hsl(var(--brand)/.12)] sm:p-3.5" style={{ animation: "trustFloat 5s ease-in-out infinite", animationDelay: `${i * 180}ms` }}>
                    <div className="relative mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light/75 text-brand-dark ring-1 ring-brand/10 transition-all duration-500 group-hover:scale-110 group-hover:bg-brand group-hover:text-primary-foreground sm:h-10 sm:w-10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-[12px] font-extrabold leading-tight text-foreground sm:text-sm">{t}</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground sm:text-[11.5px]">{s}</div>
                    <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 bg-gradient-to-r from-brand to-brand-dark transition-transform duration-500 group-hover:scale-x-100" />
                  </div>
                ))}
              </div>
              <div className="relative mt-2.5 overflow-hidden rounded-xl border border-brand/15 bg-gradient-to-r from-brand-light/45 via-card to-brand-light/30 shadow-inner sm:mt-5">
                <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "trustShimmer 4.5s ease-in-out infinite" }} />
                <div className="grid grid-cols-3 divide-x divide-border/60">
                  <AnimatedStat value={100000} suffix="+" label="সন্তুষ্ট বাগানি" icon={Sprout} />
                  <AnimatedStat value={500} suffix="+" label="বীজ ও পণ্য" icon={Leaf} />
                  <AnimatedStat value={64} label="জেলায় ডেলিভারি" icon={MapPin} />
                </div>
              </div>
              <div className="relative mt-2 flex items-center justify-center gap-2 text-[9px] font-semibold text-muted-foreground sm:text-[11px]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-light text-brand-dark" style={{ animation: "trustPulse 2.4s ease-in-out infinite" }}><ShieldCheck className="h-3 w-3" /></span>
                বিশ্বস্ত সেবা • সহজ অর্ডার • সারাদেশে ডেলিভারি
              </div>
            </div>
          </div>
        </div>
      </section>

</SiteLayout>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sheikh Seeds — অরিজিনাল বীজ, গার্ডেন টুলস ও সার | সারাদেশে ডেলিভারি" },
      { name: "description", content: "Sheikh Seeds (শেখ সিডস) — অরিজিনাল সবজি, ফল ও ফুলের বীজ, কৃষি ও গার্ডেন টুলস, সার ও কীটনাশক অনলাইনে অর্ডার করুন। সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।" },
      { name: "keywords", content: "Sheikh Seeds, শেখ সিডস, sheikhseeds, বীজ, সবজির বীজ, ফুলের বীজ, ফলের বীজ, গার্ডেন টুলস, সার, কীটনাশক, কৃষি, অনলাইন নার্সারি, seeds bangladesh" },
      { property: "og:title", content: "Sheikh Seeds — অরিজিনাল বীজ, গার্ডেন টুলস ও সার" },
      { property: "og:description", content: "অরিজিনাল বীজ, গার্ডেন টুলস, সার ও কীটনাশক — সারাদেশে হোম ডেলিভারি।" },
      { property: "og:url", content: "https://sheikhseeds.com/" },
    ],
    links: [{ rel: "canonical", href: "https://sheikhseeds.com/" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQueryOptions),
  component: Home,
});
