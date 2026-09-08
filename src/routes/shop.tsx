import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  component: Shop,
});

type ShopCategory = { id: string; name: string; slug: string; parent_id: string | null };
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

  const { data: categories = [] } = useQuery({
    queryKey: ["shop-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,parent_id").is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as ShopCategory[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products", q, cat],
    queryFn: async () => {
      let categoryIds: string[] | null = null;
      if (cat) {
        const { data: selected, error: selectedError } = await (supabase.from("categories") as any).select("id").eq("slug", cat).maybeSingle();
        if (selectedError) throw selectedError;
        if (!selected?.id) return [];
        const { data: children, error: childError } = await (supabase.from("categories") as any).select("id").eq("parent_id", selected.id);
        if (childError) throw childError;
        categoryIds = [selected.id, ...((children ?? []) as Array<{ id: string }>).map((c) => c.id)];
      }
      let query = supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true);
      if (categoryIds) query = query.in("category_id", categoryIds);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const activeCat = categories.find((c) => c.slug === cat);
  const heading = q ? `"${q}" এর ফলাফল` : activeCat ? activeCat.name : "সকল পণ্য";

  return (
    <SiteLayout>
      <style>{`
        @keyframes shopCategoryFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes shopIconPulse { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(22,163,74,.16)} 50%{transform:scale(1.06);box-shadow:0 0 0 5px rgba(22,163,74,0)} }
        @keyframes shopReveal { from{opacity:0;transform:translateY(10px) scale(.985)} to{opacity:1;transform:none} }
        .shop-category-card { animation:shopCategoryFloat 3.8s ease-in-out infinite; }
        .shop-category-card:nth-child(2n){animation-delay:-1.1s}.shop-category-card:nth-child(3n){animation-delay:-2.1s}
        .shop-category-icon { animation:shopIconPulse 2.8s ease-in-out infinite; }
        .shop-product-reveal { animation:shopReveal .48s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion:reduce){.shop-category-card,.shop-category-icon,.shop-product-reveal{animation:none!important}}
      `}</style>

      <main className="container mx-auto px-2.5 py-3 sm:px-4 sm:py-5 pb-5">
        <section className="mb-3.5 sm:mb-5">
          <div className="flex items-end justify-between gap-3 mb-2.5 px-0.5">
            <div>
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[.16em] text-brand/70 mb-0.5">Sheikh Seeds Collection</p>
              <h1 className="text-[22px] sm:text-2xl font-extrabold leading-tight text-brand-dark">{heading}</h1>
            </div>
            <span className="shrink-0 rounded-full bg-brand-light/55 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-brand-dark">{products.length} টি পণ্য</span>
          </div>

          <div className="rounded-2xl border border-brand/10 bg-white/95 p-1.5 shadow-[0_8px_28px_-18px_rgba(20,83,45,.45)] backdrop-blur-sm">
            <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link to="/shop" className={`shop-category-card group flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-center transition-all duration-300 active:scale-95 ${!cat ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/20" : "text-foreground hover:bg-brand-light/40"}`}>
                <span className={`shop-category-icon flex h-8 w-8 items-center justify-center rounded-full ${!cat ? "bg-white/15 text-white" : "bg-brand-light/70 text-brand-dark"}`}><Grid3X3 className="h-4 w-4" /></span>
                <span className="text-[11px] font-extrabold leading-none">সব পণ্য</span>
              </Link>
              {categories.map((c, i) => {
                const Icon = getCategoryIcon(c.name, i);
                const active = cat === c.slug;
                return (
                  <Link key={c.id} to="/shop" search={{ cat: c.slug } as never} className={`shop-category-card group flex min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-center transition-all duration-300 active:scale-95 ${active ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-md shadow-brand/20" : "text-foreground hover:bg-brand-light/40"}`}>
                    <span className={`shop-category-icon flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-white/15 text-white" : "bg-brand-light/70 text-brand-dark"}`}><Icon className="h-4 w-4" /></span>
                    <span className="max-w-[72px] truncate text-[11px] font-extrabold leading-none">{c.name}</span>
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
