import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { ShieldCheck, Truck, Headphones, ArrowRight, Sparkles, ChevronDown } from "lucide-react";
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
const FALLBACK_HOME: HomeData = { banners: HERO_BANNERS, categories: [], subcategories: [], products: [] };

const homeQueryOptions = queryOptions({
  queryKey: ["home-data-v1"],
  queryFn: getHomeData,
  enabled: typeof window !== "undefined",
  staleTime: 5 * 60_000,
  retry: 1,
  refetchOnMount: "always",
});

export const Route = createFileRoute("/")({
  head: () => ({
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
      { rel: "preload", as: "image", href: PROMO_BANNER_URL },
    ],
  }),
  component: Home,
});

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: { label: string; to: string } }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-dark tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm sm:text-base text-muted-foreground max-w-xl">{subtitle}</p>}
      </div>
      {action && (
        <Link to={action.to} className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors group">
          {action.label}<ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const router = useRouter();
  const { data: home = FALLBACK_HOME, isPending } = useQuery(homeQueryOptions);
  const banners = (home.banners.length ? home.banners : HERO_BANNERS) as HomeData["banners"];
  const categories = home.categories;
  const subcategories = home.subcategories;
  const popularProducts = home.products as unknown as Product[];
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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

  useEffect(() => {
    if (!banners?.length || isPaused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners, isPaused]);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const visibleSubcategories = selectedCategory ? subcategories.filter((s) => s.parent_id === selectedCategory.id) : [];

  return (
    <SiteLayout>
      {banners.length > 0 && (
        <section className="bg-background">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="relative aspect-[16/7] sm:aspect-[21/8] lg:aspect-[21/7] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/10 ring-1 ring-black/5 group" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
              {banners.map((b, i) => {
                const copy = HERO_COPY[b.id as string];
                return (
                  <a key={b.id} href={b.link_url || "#"} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === slide ? "opacity-100 z-10" : "opacity-0 z-0"}`} aria-hidden={i !== slide}>
                    <img src={b.image_url} alt={b.title || "Banner"} width={1600} height={600} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} decoding={i === 0 ? "sync" : "async"} {...(i === 0 ? ({ fetchPriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>) : {})} />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-center">
                      <div className="pl-6 sm:pl-12 lg:pl-20 pr-4 w-full max-w-[72%] sm:max-w-[58%] lg:max-w-[52%] py-2">
                        {copy ? (
                          <>
                            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] sm:text-xs font-semibold tracking-wide text-white/95 ring-1 ring-white/25"><Sparkles className="w-3 h-3" />{copy.eyebrow}</span>
                            <h2 className="mt-0 sm:mt-3 whitespace-pre-line font-extrabold leading-[1.2] tracking-tight text-white text-[15px] sm:text-2xl lg:text-[2.5rem] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">{copy.heading}</h2>
                            <p className="hidden sm:block mt-2 text-xs lg:text-sm text-white/85 leading-relaxed max-w-sm">{copy.sub}</p>
                            <span className="mt-2 sm:mt-4 inline-flex items-center gap-1.5 rounded-full bg-white text-brand-dark px-3.5 sm:px-5 py-1.5 sm:py-2.5 text-[11px] sm:text-sm font-bold whitespace-nowrap shadow-lg shadow-black/20">{copy.cta}<ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></span>
                          </>
                        ) : b.title ? <h2 className="font-extrabold leading-tight tracking-tight text-white text-lg sm:text-3xl lg:text-4xl">{b.title}</h2> : null}
                      </div>
                    </div>
                  </a>
                );
              })}
              {banners.length > 1 && <div className="absolute bottom-3 sm:bottom-5 right-4 sm:right-6 flex items-center gap-2 z-20">{banners.map((_, i) => <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} aria-current={i === slide} className={`h-2 rounded-full transition-all duration-300 ${i === slide ? "w-7 bg-white shadow-md" : "w-2 bg-white/70 hover:bg-white"}`} />)}</div>}
            </div>
          </div>
        </section>
      )}

      <section className="py-8 sm:py-12 bg-gradient-to-b from-brand-light/25 via-transparent to-transparent">
        <div className="container mx-auto px-3 sm:px-4">
          <SectionTitle title="পপুলার ক্যাটেগরি" />

          {isPending ? (
            <div className="rounded-2xl border border-dashed bg-white/90 p-8 text-center text-sm text-muted-foreground">ক্যাটাগরি লোড হচ্ছে...</div>
          ) : categories.length > 0 ? (
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {categories.map((category) => {
                  const active = selectedCategoryId === category.id;
                  const count = subcategories.filter((s) => s.parent_id === category.id).length;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(active ? null : category.id)}
                      aria-expanded={active}
                      className={`group text-left rounded-2xl sm:rounded-3xl border bg-white overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${active ? "border-brand ring-2 ring-brand/15 shadow-md" : "border-border/70 hover:border-brand/30"}`}
                    >
                      <div className="relative aspect-square overflow-hidden bg-brand-light/30">
                        {category.image_url ? (
                          <img src={toImg(category.image_url, { w: 420, q: 78 })} srcSet={imgSrcSet(category.image_url, [210, 320, 420])} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 210px" alt={category.name} width={420} height={420} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">🌱</div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
                        <div className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 text-brand flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${active ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      <div className="px-3 py-3 sm:py-3.5 flex items-center justify-between gap-2">
                        <span className="font-bold text-sm sm:text-base text-foreground line-clamp-1">{category.name}</span>
                        {count > 0 && <span className="shrink-0 text-[10px] sm:text-xs font-semibold text-muted-foreground">{count}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedCategory && (
                <div className="mt-4 sm:mt-5 rounded-2xl sm:rounded-3xl bg-white border border-brand/15 shadow-sm p-3.5 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="font-extrabold text-base sm:text-lg text-brand-dark">{selectedCategory.name}</h3>
                    <button type="button" onClick={() => setSelectedCategoryId(null)} className="text-xs sm:text-sm font-semibold text-muted-foreground hover:text-brand">বন্ধ করুন</button>
                  </div>
                  {visibleSubcategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {visibleSubcategories.map((sub) => (
                        <Link key={sub.id} to="/category/$slug" params={{ slug: sub.slug }} className="inline-flex items-center min-h-10 px-4 sm:px-5 rounded-full border border-border bg-background text-sm sm:text-[15px] font-semibold text-foreground hover:border-brand hover:bg-brand hover:text-white active:scale-[0.98] transition-all">
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link to="/category/$slug" params={{ slug: selectedCategory.slug }} className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-full bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors">
                      এই ক্যাটাগরির পণ্য দেখুন <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-white/90 p-8 text-center text-sm text-muted-foreground">এখনো কোনো হোম ক্যাটাগরি যোগ করা হয়নি।</div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <SectionTitle title="পপুলার পণ্য" subtitle="সবচেয়ে বেশি বিক্রি হওয়া পণ্য আগে দেখানো হচ্ছে" action={{ label: "সকল পণ্য দেখুন", to: "/shop" }} />
        {popularProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">{popularProducts.map((product) => <ProductCard key={product.id} p={product} />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">এখনো কোনো পণ্য যোগ করা হয়নি।</div>
        )}
      </section>

      <section className="py-12 sm:py-16 bg-gradient-to-b from-transparent via-brand-light/20 to-transparent">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-light/60 text-brand-dark text-[11px] sm:text-xs font-bold tracking-wide ring-1 ring-brand/15"><Sparkles className="w-3.5 h-3.5" />কেন আমরা আলাদা</span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-dark tracking-tight">আমাদের বিশেষ সুবিধা</h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">ছাদ বাগান থেকে বাণিজ্যিক চাষ — প্রতিটি ধাপে আমরা পাশে আছি।</p>
            <span className="mt-5 mx-auto block h-1 w-16 rounded-full bg-gradient-to-r from-brand to-brand-dark" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {[
              { icon: ShieldCheck, t: "অরিজিনাল বীজ", s: "পরীক্ষিত ও উচ্চ অংকুরোদগম হার নিশ্চিত। প্রতিটি পণ্য গুণগত মান যাচাই করে পাঠানো হয়।", n: "০১" },
              { icon: Truck, t: "দ্রুত ডেলিভারি", s: "সারা বাংলাদেশে নিরাপদ প্যাকেজিং ও দ্রুত পৌঁছে যায়। ক্যাশ অন ডেলিভারি সুবিধা।", n: "০২" },
              { icon: Headphones, t: "কৃষি পরামর্শ", s: "অভিজ্ঞ কৃষিবিদদের কাছ থেকে বপন, পরিচর্যা ও রোগবালাই নিয়ে সরাসরি পরামর্শ।", n: "০৩" },
            ].map(({ icon: Icon, t, s, n }) => (
              <div key={t} className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-card border border-border/70 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-brand/30 transition-all duration-300 p-5 sm:p-7">
                <span className="pointer-events-none absolute -top-6 -right-3 text-6xl sm:text-7xl font-black text-brand/5 select-none">{n}</span>
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-brand-dark scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
                <div className="relative">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-4 bg-brand-light/70 text-brand-dark ring-1 ring-brand/15 group-hover:bg-brand group-hover:text-primary-foreground transition-colors duration-300"><Icon className="w-6 h-6 sm:w-7 sm:h-7" /></div>
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
