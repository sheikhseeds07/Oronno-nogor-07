import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";
import { Leaf, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({
  // The page needs category → children → products in sequence. Resolving that
  // chain on the server turns four browser round-trips into finished HTML.
  loader: async ({ params, context }) => {
    const queryClient = (context as { queryClient?: import("@tanstack/react-query").QueryClient }).queryClient;
    if (!queryClient || queryClient.getQueryData(["cat", params.slug])) return null;
    const columns = "id,name,slug,image_url,parent_id,display_order";
    const [listRes, catRes] = await Promise.all([
      (supabase.from("categories") as any).select(columns).is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at").limit(100),
      (supabase.from("categories") as any).select(columns).eq("slug", params.slug).maybeSingle(),
    ]);
    queryClient.setQueryData(["cat-list"], listRes.data ?? []);
    const cat = (catRes.data ?? null) as { id: string } | null;
    queryClient.setQueryData(["cat", params.slug], cat);
    if (!cat) return null;
    const childrenRes = await (supabase.from("categories") as any).select(columns).eq("parent_id", cat.id).order("display_order").order("created_at");
    const children = (childrenRes.data ?? []) as Array<{ id: string }>;
    queryClient.setQueryData(["cat-children", cat.id], children);
    const ids = [cat.id, ...children.map((c) => c.id)];
    const productsRes = await supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).in("category_id", ids).order("created_at", { ascending: false });
    queryClient.setQueryData(["cat-products", cat.id, children.map((c) => c.id).join(",")], productsRes.data ?? []);
    return null;
  },
  component: CategoryPage,
});

type CategoryRow = { id: string; name: string; slug: string; image_url: string | null; parent_id: string | null; display_order: number };

function CategoryPage() {
  const { slug } = useParams({ from: "/category/$slug" });
  const subcatRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["cat-list"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select("id,name,slug,image_url,parent_id,display_order")
        .is("parent_id", null)
        .eq("is_hidden_from_home", false)
        .order("display_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const { data: cat } = useQuery({
    queryKey: ["cat", slug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select("id,name,slug,image_url,parent_id,display_order")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CategoryRow | null;
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["cat-children", cat?.id],
    enabled: Boolean(cat?.id),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select("id,name,slug,image_url,parent_id,display_order")
        .eq("parent_id", cat!.id)
        .order("display_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["cat-products", cat?.id, children.map((c) => c.id).join(",")],
    enabled: Boolean(cat?.id),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const ids = [cat!.id, ...children.map((c) => c.id)];
      const { data, error } = await supabase
        .from("products")
        .select("id,name,slug,price,sale_price,images,stock,short_description,description")
        .eq("is_active", true)
        .in("category_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  // Slowly reveal that more subcategories exist. Stops while the user interacts.
  useEffect(() => {
    const el = subcatRef.current;
    if (!el || children.length < 3 || el.scrollWidth <= el.clientWidth + 4) return;

    let raf = 0;
    let last = performance.now();
    let pausedUntil = 0;
    const speed = 0.18;

    const pause = () => { pausedUntil = performance.now() + 2800; };
    el.addEventListener("pointerdown", pause, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("mouseenter", pause, { passive: true });

    const tick = (now: number) => {
      const delta = Math.min(now - last, 50);
      last = now;
      if (now >= pausedUntil) {
        el.scrollLeft += delta * speed;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) el.scrollLeft = 0;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("mouseenter", pause);
    };
  }, [children.length]);

  return (
    <SiteLayout>
      <style>{`
        @keyframes catSlide{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes catFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes catShine{0%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
        .cat-slide{animation:catSlide .35s ease both}
        .cat-float{animation:catFloat 3s ease-in-out infinite}
        .cat-shine{position:relative;overflow:hidden}
        .cat-shine:after{content:"";position:absolute;inset:0;width:28%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:translateX(-130%);animation:catShine 5s ease-in-out infinite;pointer-events:none}
        .subcat-scroll{scroll-behavior:smooth;overscroll-behavior-x:contain;scrollbar-width:none;-ms-overflow-style:none}
        .subcat-scroll::-webkit-scrollbar{display:none}
        @media(prefers-reduced-motion:reduce){.cat-slide,.cat-float,.cat-shine:after{animation:none!important}.subcat-scroll{scroll-behavior:auto}}
      `}</style>

      <main className="min-h-screen bg-gradient-to-b from-[#fffafb] via-background to-background">
        <div className="container mx-auto max-w-7xl px-3 pb-8 pt-2 sm:px-5 sm:pt-4">
          <nav className="-mx-3 overflow-x-auto px-3 pb-1 scrollbar-none sm:-mx-5 sm:px-5" aria-label="প্রধান ক্যাটাগরি">
            <div className="flex min-w-max justify-center gap-1.5">
              <Link to="/shop" className="cat-slide flex h-11 items-center justify-center rounded-xl border border-border/80 bg-white px-3 text-[13px] font-extrabold shadow-sm transition-all hover:-translate-y-0.5">সব</Link>
              {categories.map((c, i) => {
                const active = c.slug === slug;
                return (
                  <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} style={{ animationDelay: `${i * 25}ms` }} className={`cat-slide group flex h-11 min-w-[82px] items-center gap-1.5 rounded-xl border px-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${active ? "border-brand bg-brand text-white shadow-[0_5px_14px_rgba(190,55,91,.2)]" : "border-border/80 bg-white text-foreground hover:border-brand/35"}`}>
                    <span className={`h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white/90 ring-1 ${active ? "ring-white/30" : "ring-black/5"}`}>
                      {c.image_url ? <img src={toImg(c.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-brand">🌱</span>}
                    </span>
                    <span className="max-w-[66px] truncate text-[11.5px] font-extrabold">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {cat && (
            <section className="cat-slide mx-auto mt-2 max-w-6xl">
              <div className="cat-shine rounded-2xl border border-brand/15 bg-white/95 px-2.5 py-2 shadow-[0_3px_16px_rgba(85,40,55,.05)] sm:px-3">
                <div className="flex items-center gap-2.5">
                  <div className="cat-float h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-brand-light/40 p-0.5 ring-1 ring-brand/15 sm:h-11 sm:w-11">
                    {cat.image_url ? <img src={toImg(cat.image_url)} alt={cat.name} className="h-full w-full rounded-[10px] object-cover" loading="eager" /> : <div className="flex h-full w-full items-center justify-center text-base">🌱</div>}
                  </div>
                  <div className="min-w-0 shrink-0">
                    <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[.16em] text-brand/70"><Sparkles className="h-2.5 w-2.5" /> SHEIKH SEEDS</div>
                    <h1 className="text-base font-black leading-tight text-brand-dark sm:text-lg">{cat.name}</h1>
                  </div>

                  {children.length > 0 && (
                    <div className="relative min-w-0 flex-1 overflow-hidden">
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-gradient-to-r from-white/95 to-transparent" />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-gradient-to-l from-white via-white/80 to-transparent" />
                      {children.length > 2 && <div className="pointer-events-none absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-full bg-brand/90 px-1.5 py-1 text-[8px] font-black text-white shadow-sm"><ChevronRight className="h-2.5 w-2.5" /></div>}
                      <div ref={subcatRef} className="subcat-scroll overflow-x-auto"><div className="flex min-w-max justify-start gap-1.5 pr-7">
                        {children.map((child, i) => <Link key={child.id} to="/category/$slug" params={{ slug: child.slug }} style={{ animationDelay: `${i * 35}ms` }} className="cat-slide group flex h-9 shrink-0 items-center gap-1 rounded-full border border-border/80 bg-[#fffdfd] px-2.5 text-[11px] font-bold shadow-sm transition-all duration-300 hover:border-brand hover:bg-brand hover:text-white active:scale-95"><span className="h-5 w-5 overflow-hidden rounded-full bg-brand-light/40 ring-1 ring-black/5">{child.image_url ? <img src={toImg(child.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-[9px]">🌿</span>}</span><span className="max-w-[75px] truncate">{child.name}</span><ChevronRight className="h-3 w-3 opacity-40" /></Link>)}
                      </div></div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {products.length > 0 ? (
            <section className="mt-4 sm:mt-6">
              <div className="mb-3 flex items-end justify-between sm:mb-4"><div><div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-brand/70"><Leaf className="h-3.5 w-3.5" /> COLLECTION</div><h2 className="mt-0.5 text-xl font-black tracking-tight text-brand-dark sm:text-2xl">পণ্যসমূহ</h2></div><span className="rounded-full bg-brand/8 px-3 py-1 text-[10px] font-bold text-brand">{products.length}টি পণ্য</span></div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </section>
          ) : <div className="mx-auto mt-6 max-w-md rounded-3xl border border-dashed border-border bg-white py-12 text-center text-muted-foreground"><Leaf className="mx-auto mb-2 h-7 w-7 opacity-50" /><p className="font-semibold">কোনো পণ্য নেই</p></div>}
        </div>
      </main>
    </SiteLayout>
  );
}
