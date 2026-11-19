import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Apple, Flower2, Leaf, Shovel, Sparkles, Sprout, Wheat, Wrench, Layers3, Home, Globe2, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { trackSearch } from "@/lib/fbq";

type ShopSection = "categories" | "home" | "landing" | "all";
export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [
    { title: "শপ — সব বীজ, গার্ডেন টুলস ও সার | Sheikh Seeds" },
    { name: "description", content: "Sheikh Seeds শপ — সবজি, ফল ও ফুলের অরিজিনাল বীজ, গার্ডেন টুলস, সার ও কীটনাশকের সম্পূর্ণ কালেকশন। সারাদেশে ক্যাশ অন ডেলিভারি।" },
    { property: "og:title", content: "শপ — সব বীজ, গার্ডেন টুলস ও সার | Sheikh Seeds" },
    { property: "og:description", content: "অরিজিনাল বীজ, টুলস ও সারের সম্পূর্ণ কালেকশন।" },
    { property: "og:url", content: "https://sheikhseeds.com/shop" },
  ], links: [{ rel: "canonical", href: "https://sheikhseeds.com/shop" }] }),
  validateSearch: (s: Record<string, unknown>): { q?: string; cat?: string; section?: ShopSection } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
    section: s.section === "landing" || s.section === "all" || s.section === "home" ? s.section : "categories",
  }),
  loaderDeps: ({ search }: { search: { q?: string; cat?: string; section?: ShopSection } }) => ({ q: search.q, cat: search.cat, section: search.section ?? "home" }),
  loader: async ({ deps, context }: { deps: { q?: string; cat?: string; section: ShopSection }; context: unknown }) => {
    const queryClient = (context as { queryClient?: import("@tanstack/react-query").QueryClient }).queryClient;
    if (!queryClient) return null;
    await Promise.all([
      queryClient.ensureQueryData(shopCategoriesOptions()),
      queryClient.ensureQueryData(shopProductsOptions(deps.q, deps.cat, deps.section)),
    ]);
    return null;
  },
  component: Shop,
});

type ShopCategory = { id: string; name: string; slug: string; parent_id: string | null; image_url?: string | null };
const shopCategoriesOptions = () => queryOptions({
  queryKey: ["shop-categories"],
  staleTime: 10 * 60_000,
  queryFn: async () => {
    const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,parent_id,image_url").is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at").limit(100);
    if (error) throw error;
    return (data ?? []) as ShopCategory[];
  },
});
const shopProductsOptions = (q?: string, cat?: string, section: ShopSection = "categories") => queryOptions({
  queryKey: ["shop-products", q, cat, section],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    let categoryIds: string[] | null = null;
    if (cat) {
      const { data: selected, error: selectedError } = await (supabase.from("categories") as any).select("id").eq("slug", cat).maybeSingle();
      if (selectedError) throw selectedError;
      if (!selected?.id) return [] as Product[];
      const { data: children, error: childError } = await (supabase.from("categories") as any).select("id").eq("parent_id", selected.id);
      if (childError) throw childError;
      categoryIds = [selected.id, ...((children ?? []) as Array<{ id: string }>).map(c => c.id)];
    }
    let query = supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description,display_section").eq("is_active", true).eq("is_offer", false).eq("is_archived", false);
    if (section !== "all") query = query.eq("display_section", section);
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
  const { q, cat, section = "home" } = useSearch({ from: "/shop" });
  const lastSearch = useRef("");
  useEffect(() => {
    const term = q?.trim() ?? "";
    if (term && term !== lastSearch.current) { lastSearch.current = term; trackSearch(term); }
  }, [q]);
  const { data: categories = [] } = useQuery(shopCategoriesOptions());
  const productSection: ShopSection = section === "categories" ? "all" : section;
  const { data: products = [] } = useQuery({ ...shopProductsOptions(q, cat, productSection), placeholderData: keepPreviousData });
  const activeCat = categories.find(c => c.slug === cat);
  const categoryView = section === "categories" && !cat && !q;
  const title = q ? `"${q}" এর ফলাফল` : activeCat ? activeCat.name : section === "categories" ? "ক্যাটাগরি নির্বাচন করুন" : section === "landing" ? "Landing Page Product" : section === "all" ? "All Product" : "Home Product";
  return (
    <SiteLayout>
      <style>{`
        @keyframes shopGlow {0%,100%{opacity:.5;transform:scaleX(.75)}50%{opacity:1;transform:scaleX(1)}}
        @keyframes shopReveal {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .shop-premium-reveal{animation:shopReveal .4s cubic-bezier(.2,.8,.2,1) both}
        @media(prefers-reduced-motion:reduce){.shop-premium-reveal{animation:none!important}}
      `}</style>
      <main className="mx-auto w-full max-w-6xl px-3 pb-8 pt-5 sm:px-5 sm:pt-8">
        <div className="mx-auto max-w-5xl">
          <section className="relative mb-5 overflow-hidden rounded-[26px] border border-emerald-900/10 bg-gradient-to-br from-[#123d2a] via-[#1e593b] to-[#2f7048] p-4 text-white shadow-[0_18px_45px_-24px_rgba(15,55,32,.65)] sm:mb-7 sm:rounded-[32px] sm:p-7">
            <div className="absolute inset-x-12 top-0 h-px bg-white/30" style={{animation:"shopGlow 3s ease-in-out infinite"}}/>
            <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full border border-white/10 bg-white/[.04]"/>
            <div className="pointer-events-none absolute -bottom-24 -left-14 h-48 w-48 rounded-full border border-white/10"/>
            <div className="relative flex flex-col items-center text-center">
              <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-50"><Leaf className="h-3.5 w-3.5"/> Sheikh Seeds • Collection</span>
              <h1 className="text-balance text-xl font-black tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-emerald-50/80 sm:text-sm">{q ? "আপনার অনুসন্ধানের সাথে মিলে যাওয়া পণ্য" : activeCat ? "এই ক্যাটাগরির পণ্যগুলো দেখুন ও পছন্দ করুন" : section === "categories" ? "আপনার বাগানের প্রয়োজনীয় জিনিস সহজে খুঁজে নিন" : section === "landing" ? "Landing Page-এ ব্যবহৃত পণ্যগুলোর কালেকশন" : section === "all" ? "আমাদের সম্পূর্ণ পণ্য সংগ্রহ এক জায়গায়" : "হোম পেজের নির্বাচিত পণ্যসমূহ"}</p>
            </div>
          </section>
          <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm sm:mb-7 sm:rounded-3xl sm:p-3">
            <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
              {[
                {key:"home",label:"Home",icon:Home},
                {key:"home-product",label:"Home Product",icon:Sprout},
                {key:"landing",label:"Landing Page Product",icon:Layers3},
                {key:"all",label:"All Product",icon:Globe2},
              ].map((tab,i)=>{
                const active = (tab.key==="home-product" ? section==="home"&&!cat&&!q : section===tab.key&&(tab.key!=="categories"||true));
                const toSection: ShopSection = tab.key==="home-product" ? "home" : tab.key==="categories" ? "categories" : tab.key==="landing" ? "landing" : "all";
                return <Link key={tab.key} to="/shop" search={{section:toSection,cat:undefined,q} as never} className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[10px] font-extrabold transition-all sm:min-h-[60px] sm:rounded-2xl sm:text-xs ${active?"bg-gradient-to-br from-[#123d2a] to-[#2f7048] text-white shadow-md":"bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"}`}>
                  <tab.icon className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"/><span>{tab.label}</span>
                </Link>;
              })}
            </nav>
          </section>
          {section==="categories" && !q && (
            <section className="mb-5 sm:mb-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div><h2 className="text-base font-black text-[#153f2c] sm:text-xl">ক্যাটাগরি</h2><p className="text-[11px] text-slate-500 sm:text-xs">পছন্দের বিভাগে ট্যাপ করে পণ্য দেখুন</p></div>
                {cat&&<Link to="/shop" search={{section:"categories"} as never} className="rounded-full border border-emerald-800/10 px-3 py-1.5 text-[11px] font-bold text-emerald-900">সব ক্যাটাগরি</Link>}
              </div>
              {!cat ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
                  {categories.map((c,i)=>{
                    const Icon=getCategoryIcon(c.name,i);
                    return <Link key={c.id} to="/shop" search={{section:"categories",cat:c.slug} as never} className="group shop-premium-reveal relative flex min-h-[130px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-emerald-900/10 bg-white px-3 py-4 text-center shadow-[0_8px_25px_-18px_rgba(20,83,45,.45)] transition-all hover:-translate-y-1 hover:border-emerald-700/30 hover:shadow-lg sm:min-h-[170px] sm:rounded-[26px]" style={{animationDelay:`${Math.min(i*40,320)}ms`}}>
                      {c.image_url?<img src={c.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-[.12] transition-transform duration-500 group-hover:scale-110"/>:null}
                      <span className="relative mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-[#24613d] shadow-inner sm:h-14 sm:w-14 sm:rounded-[20px]"><Icon className="h-6 w-6 sm:h-7 sm:w-7"/></span>
                      <span className="relative text-xs font-black text-[#183f2d] sm:text-sm">{c.name}</span>
                      <span className="relative mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-800/65">পণ্য দেখুন <ChevronRight className="h-3 w-3"/></span>
                    </Link>;
                  })}
                </div>
              ) : (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <Link to="/shop" search={{section:"home"} as never} className="shrink-0 rounded-full border border-emerald-900/10 bg-white px-3.5 py-2 text-xs font-bold text-slate-600">← সব বিভাগ</Link>
                  {categories.map((c,i)=>{const Icon=getCategoryIcon(c.name,i);return <Link key={c.id} to="/shop" search={{section:"home",cat:c.slug} as never} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold ${cat===c.slug?"bg-emerald-900 text-white shadow":"border border-emerald-900/10 bg-white text-emerald-900"}`}><Icon className="h-3.5 w-3.5"/>{c.name}</Link>})}
                </div>
              )}
            </section>
          )}
          {(!categoryView || q) && (
            <section>
              <div className="mb-3 flex items-end justify-between gap-2">
                <div><h2 className="text-base font-black text-[#153f2c] sm:text-xl">{activeCat?.name ?? (q ? "সার্চ রেজাল্ট" : section==="landing"?"Landing Page Product":section==="all"?"All Product":"Home Product")}</h2><p className="text-[11px] text-slate-500 sm:text-xs">মোট {products.length} টি প্রোডাক্ট</p></div>
              </div>
              {products.length>0?<div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">{products.map((p,i)=><div key={p.id} className="shop-premium-reveal" style={{animationDelay:`${Math.min(i*30,300)}ms`}}><ProductCard p={p}/></div>)}</div>:<div className="rounded-2xl border border-dashed border-emerald-900/20 bg-emerald-50/40 px-5 py-12 text-center text-sm font-semibold text-slate-500">এই বিভাগে এখন কোনো পণ্য পাওয়া যায়নি</div>}
            </section>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
