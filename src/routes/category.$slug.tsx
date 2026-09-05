import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { toImg } from "@/lib/img";
import { Leaf, ChevronRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({ component: CategoryPage });

type CategoryRow = { id: string; name: string; slug: string; image_url: string | null; parent_id: string | null; display_order: number };

function CategoryPage() {
  const { slug } = useParams({ from: "/category/$slug" });
  const { data: categories = [] } = useQuery({
    queryKey: ["cat-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,image_url,parent_id,display_order").is("parent_id", null).eq("is_hidden_from_home", false).order("display_order").order("created_at");
      if (error) throw error; return (data ?? []) as CategoryRow[];
    },
  });
  const { data: cat } = useQuery({
    queryKey: ["cat", slug],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,image_url,parent_id,display_order").eq("slug", slug).maybeSingle();
      if (error) throw error; return (data ?? null) as CategoryRow | null;
    },
  });
  const { data: children = [] } = useQuery({
    queryKey: ["cat-children", cat?.id], enabled: Boolean(cat?.id),
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any).select("id,name,slug,image_url,parent_id,display_order").eq("parent_id", cat!.id).order("display_order").order("created_at");
      if (error) throw error; return (data ?? []) as CategoryRow[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["cat-products", cat?.id, children.map((c) => c.id).join(",")], enabled: Boolean(cat?.id),
    queryFn: async () => {
      const ids = [cat!.id, ...children.map((c) => c.id)];
      const { data, error } = await supabase.from("products").select("id,name,slug,price,sale_price,images,stock,short_description,description").eq("is_active", true).in("category_id", ids).order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <SiteLayout>
      <style>{`@keyframes catFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes catShine{0%{transform:translateX(-130%)}100%{transform:translateX(130%)}}@keyframes catIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.cat-in{animation:catIn .45s ease both}.cat-float{animation:catFloat 3s ease-in-out infinite}.cat-shine{position:relative;overflow:hidden}.cat-shine:after{content:"";position:absolute;inset:0;width:35%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);transform:translateX(-130%);animation:catShine 4.5s ease-in-out infinite;pointer-events:none}@media(prefers-reduced-motion:reduce){.cat-in,.cat-float,.cat-shine:after{animation:none!important}}`}</style>
      <main className="min-h-screen bg-gradient-to-b from-[#fffafb] via-background to-background">
        <div className="container mx-auto max-w-7xl px-3 pb-8 pt-2 sm:px-5 sm:pt-4">
          <nav className="cat-in -mx-3 overflow-x-auto px-3 pb-0.5 scrollbar-none sm:-mx-5 sm:px-5" aria-label="প্রধান ক্যাটাগরি">
            <div className="flex min-w-max justify-center gap-1.5 sm:gap-2">
              <Link to="/shop" className="group flex h-12 min-w-[54px] items-center justify-center rounded-2xl border border-border/80 bg-white px-3 text-sm font-extrabold shadow-[0_2px_10px_rgba(30,20,20,.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">সব</Link>
              {categories.map((c, i) => {
                const active = c.slug === slug;
                return <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} style={{ animationDelay: `${i * 35}ms` }} className={`group cat-in flex h-12 min-w-[88px] items-center gap-1.5 rounded-2xl border px-2 shadow-[0_2px_10px_rgba(30,20,20,.05)] transition-all duration-300 hover:-translate-y-0.5 ${active ? "border-brand bg-brand text-white shadow-[0_6px_18px_rgba(190,55,91,.22)]" : "border-border/80 bg-white text-foreground hover:border-brand/35 hover:shadow-md"}`}>
                  <span className={`h-8 w-8 shrink-0 overflow-hidden rounded-xl bg-white/90 ring-1 ${active ? "ring-white/30" : "ring-black/5"}`}>{c.image_url ? <img src={toImg(c.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-brand">🌱</span>}</span>
                  <span className="max-w-[68px] truncate text-[11.5px] font-extrabold">{c.name}</span>
                </Link>;
              })}
            </div>
          </nav>

          {cat && (
            <section className="cat-in mx-auto mt-2 max-w-5xl sm:mt-3">
              <div className="cat-shine relative overflow-hidden rounded-[20px] border border-brand/12 bg-white px-3 py-2.5 shadow-[0_5px_22px_rgba(85,40,55,.055)] sm:px-5 sm:py-3">
                <div className="absolute -right-10 -top-14 h-28 w-28 rounded-full bg-brand/8 blur-3xl" />
                <div className="relative flex items-center justify-center gap-3 text-center sm:gap-4">
                  <div className="cat-float h-12 w-12 shrink-0 overflow-hidden rounded-[15px] bg-brand-light/40 p-1 shadow-sm ring-1 ring-brand/15 sm:h-14 sm:w-14">{cat.image_url ? <img src={toImg(cat.image_url)} alt={cat.name} className="h-full w-full rounded-xl object-cover" loading="eager" /> : <div className="flex h-full w-full items-center justify-center text-lg">🌱</div>}</div>
                  <div className="min-w-0"><div className="flex items-center justify-center gap-1 text-[8.5px] font-bold uppercase tracking-[.2em] text-brand/70"><Sparkles className="h-2.5 w-2.5" /> Sheikh Seeds</div><h1 className="mt-0 text-lg font-black tracking-tight text-brand-dark sm:text-xl">{cat.name}</h1><p className="mt-0 text-[9.5px] text-muted-foreground">আপনার পছন্দের পণ্যগুলো একসাথে দেখুন</p></div>
                </div>
                {children.length > 0 && <div className="relative mt-2.5 flex justify-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {children.map((child, i) => <Link key={child.id} to="/category/$slug" params={{ slug: child.slug }} style={{ animationDelay: `${i * 45}ms` }} className="cat-in group flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-[#fffdfd] px-3 text-[11.5px] font-bold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white active:scale-95"><span className="h-6 w-6 overflow-hidden rounded-full bg-brand-light/40 ring-1 ring-black/5">{child.image_url ? <img src={toImg(child.image_url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-[10px]">🌿</span>}</span><span className="max-w-[95px] truncate">{child.name}</span><ChevronRight className="h-3 w-3 opacity-45 transition-transform group-hover:translate-x-0.5" /></Link>)}
                </div>}
              </div>
            </section>
          )}

          {products.length > 0 ? <section className="cat-in mt-4 sm:mt-6">
            <div className="mb-3 flex items-end justify-between sm:mb-4"><div><div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-brand/70"><Leaf className="h-3.5 w-3.5" /> COLLECTION</div><h2 className="mt-0.5 text-xl font-black tracking-tight text-brand-dark sm:text-2xl">পণ্যসমূহ</h2></div><span className="rounded-full bg-brand/8 px-3 py-1 text-[10px] font-bold text-brand">{products.length}টি পণ্য</span></div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section> : <div className="cat-in mx-auto mt-6 max-w-md rounded-3xl border border-dashed border-border bg-white py-12 text-center text-muted-foreground"><Leaf className="mx-auto mb-2 h-7 w-7 opacity-50" /><p className="font-semibold">কোনো পণ্য নেই</p></div>}
        </div>
      </main>
    </SiteLayout>
  );
}
