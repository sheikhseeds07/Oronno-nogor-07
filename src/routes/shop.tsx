import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Apple, Flower2, Grid3X3, Leaf, Shovel, Sparkles, Sprout, Wheat, Wrench } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { trackSearch } from "@/lib/fbq";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "শপ — সব বীজ, গার্ডেন টুলস ও সার | Sheikh Seeds" },
      { name: "description", content: "Sheikh Seeds শপ — সবজি, ফল ও ফুলের অরিজিনাল বীজ, গার্ডেন টুলস, সার ও কীটনাশকের সম্পূর্ণ কালেকশন। সারাদেশে ক্যাশ অন ডেলিভারি।" },
      { property: "og:title", content: "শপ — সব বীজ, গার্ডেন টুলস ও সার | Sheikh Seeds" },
      { property: "og:description", content: "অরিজিনাল বীজ, টুলস ও সারের সম্পূর্ণ কালেকশন।" },
      { property: "og:url", content: "https://sheikhseeds.com/shop" },
    ],
    links: [{ rel: "canonical", href: "https://sheikhseeds.com/shop" }],
  }),
  validateSearch: (s: Record<string, unknown>): { q?: string; cat?: string } => ({ q: typeof s.q === "string" ? s.q : undefined, cat: typeof s.cat === "string" ? s.cat : undefined }),
  loaderDeps: ({ search }: { search: { q?: string; cat?: string } }) => ({ q: search.q, cat: search.cat }),
  // Resolve the listing on the server so the grid arrives with the HTML.
  loader: async ({ deps, context }: { deps: { q?: string; cat?: string }; context: unknown }) => {
    const queryClient = (context as { queryClient?: import("@tanstack/react-query").QueryClient }).queryClient;
    if (!queryClient) return null;
    await Promise.all([
      queryClient.ensureQueryData(shopCategoriesOptions()),
      queryClient.ensureQueryData(shopProductsOptions(deps.q, deps.cat)),
    ]);
    return null;
  },
  component: Shop,
});

type ShopCategory = { id: string; name: string; slug: string; parent_id: string | null };

const shopCategoriesOptions = () => queryOptions({
  queryKey: ["shop-categories"],
  staleTime: 10 * 60_000,
  queryFn: async () => {
    const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,parent_id").is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at");
    if (error) throw error;
    return (data ?? []) as ShopCategory[];
  },
});

const shopProductsOptions = (q?: string, cat?: string) => queryOptions({
  queryKey: ["shop-products", q, cat],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    let categoryIds: string[] | null = null;
    if (cat) {
      const { data: selected, error: selectedError } = await (supabase.from("categories") as any).select("id").eq("slug", cat).maybeSingle();
      if (selectedError) throw selectedError;
      if (!selected?.id) return [] as Product[];
      const { data: children, error: childError } = await (supabase.from("categories") as any).select("id").eq("parent_id", selected.id);
      if (childError) throw childError;
      categoryIds = [selected.id, ...((children ?? []) as Array<{ id: string }>).map((c) => c.id)];
    }
    let query = supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).eq("is_offer", false).eq("is_archived", false);
    if (categoryIds) query = query.in("category_id", categoryIds);
    if (q) query = query.ilike("name", `%${q}%`);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  },
});
const categoryIcons = [Sprout, Wrench, Wheat, Flower2, Leaf, Apple, Shovel, Sparkles];

function getCategoryIcon(name: string, index: number) {
  const n = name.toLowerCase();
  if (n.includes("বীজ") || n.includes("seed")) return Sprout;
  if (n.includes("টুল") || n.includes("tool") || n.includes("সরঞ্জাম")) return Wrench;
  if (n.includes("সার") || n.includes("fertil")) return Wheat;
  if (n.includes("ফুল") || n.includes("flower")) return Flower2;
  if (n.includes("কীট") || n.includes("পেস্ট") || n.includes("pest")) return Sparkles;
  return categoryIcons[index % categoryIcons.length];
}

function Shop() {
  const { q, cat } = useSearch({ from: "/shop" });
  const lastSearch = useRef("");

  useEffect(() => {
    const term = q?.trim() ?? "";
    if (term && term !== lastSearch.current) { lastSearch.current = term; trackSearch(term); }
  }, [q]);

  const { data: categories = [] } = useQuery(shopCategoriesOptions());
  const { data: products = [] } = useQuery({ ...shopProductsOptions(q, cat), placeholderData: keepPreviousData });

  const activeCat = categories.find((c) => c.slug === cat);
  const heading = q ? `"${q}" এর ফলাফল` : activeCat ? activeCat.name : "সকল পণ্য";

  return (
    <SiteLayout>
      <style>{`
        @keyframes shopHeaderGlow { 0%,100%{opacity:.55;transform:scaleX(.72)} 50%{opacity:1;transform:scaleX(1)} }
        @keyframes shopHeaderShine { 0%{transform:translateX(-130%)} 55%,100%{transform:translateX(130%)} }
        @keyframes shopTabFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1px)} }
        @keyframes shopTabPulse { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,0)} 50%{box-shadow:0 0 0 4px rgba(22,163,74,.08)} }
        @keyframes shopReveal { from{opacity:0;transform:translateY(10px) scale(.985)} to{opacity:1;transform:none} }
        .shop-header-glow { animation:shopHeaderGlow 3.2s ease-in-out infinite; }
        .shop-header-shine { animation:shopHeaderShine 4.8s cubic-bezier(.4,0,.2,1) infinite; }
        .shop-tab-float { animation:shopTabFloat 3.8s ease-in-out infinite; }
        .shop-tab-pulse { animation:shopTabPulse 2.8s ease-in-out infinite; }
        .shop-product-reveal { animation:shopReveal .48s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion:reduce){.shop-header-glow,.shop-header-shine,.shop-tab-float,.shop-tab-pulse,.shop-product-reveal{animation:none!important}}
      `}</style>

      <main className="container mx-auto px-2.5 py-2.5 sm:px-4 sm:py-4 pb-5">
        <section className="mb-3.5 sm:mb-5">
          <div className="relative overflow-hidden rounded-[20px] border border-brand/10 bg-white/95 px-3 py-3 shadow-[0_10px_32px_-20px_rgba(20,83,45,.5)] backdrop-blur-md sm:rounded-[24px] sm:px-4 sm:py-3.5">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-brand/30 shop-header-glow" />
            <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/55 to-transparent shop-header-shine" />

            <div className="relative flex items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_rgba(22,163,74,.10)]" />
                  <p className="truncate text-[9px] font-extrabold uppercase tracking-[.18em] text-brand/65 sm:text-[10px]">Sheikh Seeds Collection</p>
                </div>
                <h1 className="truncate text-[20px] font-extrabold leading-tight tracking-[-.02em] text-brand-dark sm:text-[23px]">{heading}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand/10 bg-brand-light/45 px-2.5 py-1.5 text-[10px] font-extrabold text-brand-dark shadow-sm sm:px-3 sm:text-[11px]">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-40" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" /></span>
                {products.length} টি পণ্য
              </div>
            </div>

            <div className="relative mt-2.5 flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link to="/shop" className={`shop-tab-float shop-tab-pulse group flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-extrabold transition-all duration-300 active:scale-95 sm:h-10 sm:px-3.5 sm:text-[11px] ${!cat ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-[0_6px_16px_-8px_rgba(22,101,52,.7)]" : "border border-brand/10 bg-brand-light/35 text-brand-dark hover:bg-brand-light/60"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${!cat ? "bg-white/15" : "bg-white/80"}`}><Grid3X3 className="h-3.5 w-3.5" /></span>
                সব পণ্য
              </Link>
              {categories.map((c, i) => {
                const Icon = getCategoryIcon(c.name, i);
                const active = cat === c.slug;
                return (
                  <Link key={c.id} to="/shop" search={{ cat: c.slug } as never} className={`shop-tab-float group flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-extrabold transition-all duration-300 active:scale-95 sm:h-10 sm:px-3.5 sm:text-[11px] ${active ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow-[0_6px_16px_-8px_rgba(22,101,52,.7)]" : "border border-brand/10 bg-brand-light/35 text-brand-dark hover:bg-brand-light/60"}`} style={{ animationDelay: `${i * -0.45}s` }}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${active ? "bg-white/15" : "bg-white/80"}`}><Icon className="h-3.5 w-3.5" /></span>
                    <span>{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <div key={p.id} className="shop-product-reveal" style={{ animationDelay: `${Math.min(i * 35, 350)}ms` }}><ProductCard p={p} /></div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-brand/20 bg-brand-light/20 py-12 text-center text-sm font-semibold text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</div>
        )}
      </main>
    </SiteLayout>
  );
}
