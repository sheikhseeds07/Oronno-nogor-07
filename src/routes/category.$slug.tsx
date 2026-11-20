import { SafeImage } from "@/components/SafeImage";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";
import { applyTheme } from "@/lib/theme-store";
import { useLayoutEffect, useEffect, useRef } from "react";
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
    const cat = (catRes.data ?? null) as CategoryRow | null;
    if (!cat) return null;
    // Cache the complete category row; an id-only cache entry causes the
    // client query to briefly render with incomplete category metadata.
    const childrenRes = await (supabase.from("categories") as any).select(columns).eq("parent_id", cat.id).order("display_order").order("created_at");
    const children = (childrenRes.data ?? []) as CategoryRow[];
    queryClient.setQueryData(["cat", params.slug], cat);
    queryClient.setQueryData(["cat-children", cat.id], children);
    const ids = [cat.id, ...children.map((c) => c.id)];
    const productsRes = await supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).eq("display_section", "home").in("category_id", ids).order("created_at", { ascending: false });
    queryClient.setQueryData(["cat-products", cat.id, children.map((c) => c.id).join(",")], productsRes.data ?? []);
    return null;
  },
  component: CategoryPage,
});

type CategoryRow = { id: string; name: string; slug: string; image_url: string | null; parent_id: string | null; display_order: number };

function CategoryPage() {
  const { slug } = useParams({ from: "/category/$slug" });
  const subcatScrollerRef = useRef<HTMLDivElement>(null);
  const subcatPausedRef = useRef(false);
  const subcatDragRef = useRef<{ pointerId: number; startX: number; startScroll: number } | null>(null);

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

  const { data: cat, isFetching: isCategoryFetching } = useQuery({
    queryKey: ["cat", slug],
    staleTime: 0,
    refetchOnMount: "always",
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

  const { data: children = [], isFetching: isChildrenFetching } = useQuery({
    queryKey: ["cat-children", cat?.id],
    enabled: Boolean(cat?.id),
    staleTime: 0,
    refetchOnMount: "always",
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

  const { data: siblingCategories = [] } = useQuery({
    queryKey: ["cat-siblings", cat?.parent_id, cat?.id],
    enabled: Boolean(cat?.parent_id), staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,image_url,parent_id,display_order").eq("parent_id", cat!.parent_id).order("display_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });
  const { data: parentCategory } = useQuery({
    queryKey: ["cat-parent", cat?.parent_id], enabled: Boolean(cat?.parent_id), staleTime: 10 * 60 * 1000, gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug").eq("id", cat!.parent_id).maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string } | null;
    },
  });
  useLayoutEffect(() => {
    if (!cat) return;
    const categoryText = `${cat.name} ${cat.slug}`.toLocaleLowerCase("bn");
    const isFlowerOrFruit = /ফুল|ফল|flower|fruit/.test(categoryText);
    applyTheme(isFlowerOrFruit ? "sunset" : "default");
  }, [cat?.id, cat?.name, cat?.slug]);

  useEffect(() => {
    const el = subcatScrollerRef.current;
    if (!el) return;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      if (!previous) previous = time;
      const delta = Math.min(40, time - previous);
      previous = time;
      if (!subcatPausedRef.current && !subcatDragRef.current) {
        // Ten identical sets keep the scrollable track wider than the viewport
        // even when a category has only one or two subcategories.
        const setWidth = el.scrollWidth / 10;
        if (setWidth > 0 && el.scrollWidth - el.clientWidth >= setWidth) {
          el.scrollLeft += (22 * delta) / 1000;
          if (el.scrollLeft >= setWidth) el.scrollLeft -= setWidth;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cat?.id, cat?.parent_id, children.length, siblingCategories.length]);
  const { data: products = [], isFetching: isProductsFetching } = useQuery({
    queryKey: ["cat-products", cat?.id, children.map((c) => c.id).join(",")],
    enabled: Boolean(cat?.id) && !isCategoryFetching && !isChildrenFetching,
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const ids = [cat!.id, ...children.map((c) => c.id)];
      const { data, error } = await supabase
        .from("products")
        .select("id,name,slug,price,sale_price,images,stock,short_description,description")
        .eq("is_active", true)
        .eq("display_section", "home")
        .in("category_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });


  return (
    <SiteLayout>
      <style>{`
        @keyframes catSlide{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes catFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes catShine{0%{transform:translateX(-130%)}100%{transform:translateX(130%)}}
        .subcat-marquee{contain:layout paint;touch-action:pan-y;cursor:grab;scrollbar-width:none;-ms-overflow-style:none;isolation:isolate}
        .subcat-marquee::-webkit-scrollbar{display:none}
        .subcat-marquee.is-dragging{cursor:grabbing;user-select:none}
        .cat-slide{animation:catSlide .35s ease both}
        .cat-float{animation:catFloat 3s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.cat-slide,.cat-float,.cat-shine:after{animation:none!important}}
      `}</style>

      <main className="min-h-screen bg-gradient-to-b from-[#fffafb] via-background to-background">
        <div className="container mx-auto max-w-7xl px-3 pb-8 pt-2 sm:px-5 sm:pt-4">
          <nav className="-mx-3 overflow-x-auto px-3 pb-1 scrollbar-none sm:-mx-5 sm:px-5" aria-label="প্রধান ক্যাটাগরি">
            <div className="flex min-w-max justify-start gap-1.5">
              <Link to="/shop" className="cat-slide flex h-11 items-center justify-center rounded-xl border border-border/80 bg-white px-3 text-[13px] font-extrabold shadow-sm transition-all hover:-translate-y-0.5">সব</Link>
              {categories.map((c, i) => {
                const active = c.slug === slug;
                return (
                  <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} style={{ animationDelay: `${i * 25}ms` }} className={`cat-slide group flex h-11 min-w-[82px] items-center gap-1.5 rounded-xl border px-2 shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${active ? "border-brand bg-brand text-white shadow-[0_5px_14px_rgba(190,55,91,.2)]" : "border-border/80 bg-white text-foreground hover:border-brand/35"}`}>
                    <span className={`h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white/90 ring-1 ${active ? "ring-white/30" : "ring-black/5"}`}>
                      {c.image_url ? <SafeImage src={toImg(c.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-brand">🌱</span>}
                    </span>
                    <span className="max-w-[66px] truncate text-[11.5px] font-extrabold">{c.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {cat && (cat.parent_id ? siblingCategories.length > 0 : children.length > 0) && (() => {
            const items = cat.parent_id ? siblingCategories : children;
            return (
              <section className="cat-slide mx-auto mt-2 max-w-6xl">
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-brand/10 bg-white/95 p-2 shadow-sm">
                  {cat.parent_id && <div className="flex max-w-[34%] shrink-0 items-center border-r border-brand/10 pr-2"><span className="max-w-full truncate text-xs font-black text-brand-dark">{parentCategory?.name ?? "ক্যাটাগরি"}</span></div>}
                  <div
                    ref={subcatScrollerRef}
                    className="subcat-marquee relative min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
                    onPointerDown={(event) => {
                      if (event.pointerType === "mouse" && event.button !== 0) return;
                      const el = subcatScrollerRef.current; if (!el) return;
                      subcatPausedRef.current = true;
                      subcatDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startScroll: el.scrollLeft };
                      el.setPointerCapture(event.pointerId); el.classList.add("is-dragging");
                    }}
                    onPointerMove={(event) => {
                      const drag = subcatDragRef.current; const el = subcatScrollerRef.current;
                      if (!drag || !el || drag.pointerId !== event.pointerId) return;
                      el.scrollLeft = drag.startScroll - (event.clientX - drag.startX);
                    }}
                    onPointerUp={(event) => {
                      if (subcatDragRef.current?.pointerId !== event.pointerId) return;
                      subcatDragRef.current = null; subcatPausedRef.current = false;
                      subcatScrollerRef.current?.classList.remove("is-dragging");
                    }}
                    onPointerCancel={() => {
                      subcatDragRef.current = null; subcatPausedRef.current = false;
                      subcatScrollerRef.current?.classList.remove("is-dragging");
                    }}
>
                    <div className="flex w-max min-w-max gap-1.5 pr-1">
                      {Array.from({ length: 10 }, (_, copy) => items.map((item) => ({ ...item, _copy: copy }))).flat().map((item, i) => (
                        <Link key={"copy-" + item._copy + "-" + item.id} to="/category/$slug" params={{ slug: item.slug }} aria-label={item.name} className={"group flex h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold shadow-sm transition-colors duration-200 hover:border-brand hover:bg-brand hover:text-white active:scale-[.98] " + (item.slug === slug ? "border-brand bg-brand text-white" : "border-border/80 bg-[#fffdfd]")}>
                          <span className="h-5 w-5 overflow-hidden rounded-full bg-brand-light/40 ring-1 ring-black/5">{item.image_url ? <SafeImage src={toImg(item.image_url)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-[9px]">🌿</span>}</span>
                          <span className="max-w-[90px] truncate">{item.name}</span><ChevronRight className="h-3 w-3 opacity-40" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {products.length > 0 ? (
            <section className="cat-slide mx-auto mt-5 max-w-6xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="mt-0.5 text-xl font-black tracking-tight text-brand-dark sm:text-2xl">পণ্যসমূহ</h2>
                <span className="rounded-full bg-brand/8 px-3 py-1 text-[10px] font-bold text-brand">{products.length}টি পণ্য</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </section>
          ) : (isChildrenFetching || isProductsFetching) ? <div className="mx-auto mt-6 max-w-md py-12 text-center text-muted-foreground"><p className="font-semibold">পণ্য লোড হচ্ছে...</p></div> : <div className="mx-auto mt-6 max-w-md rounded-3xl border border-dashed border-border bg-white py-12 text-center text-muted-foreground"><Leaf className="mx-auto mb-2 h-7 w-7 opacity-50" /><p className="font-semibold">কোনো পণ্য নেই</p></div>}
        </div>
      </main>
    </SiteLayout>
  );
}
