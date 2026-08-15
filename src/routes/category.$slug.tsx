import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { ArrowRight, Leaf } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({ component: CategoryPage });

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  display_order: number;
};

function CategoryPage() {
  const { slug } = useParams({ from: "/category/$slug" });

  const { data: categories = [] } = useQuery({
    queryKey: ["cat-list"],
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
    queryFn: async () => {
      const categoryIds = [cat!.id, ...children.map((c) => c.id)];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .in("category_id", categoryIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-7">
        <div className="flex gap-2 overflow-x-auto pb-2.5 mb-6 -mx-3 px-3 sm:-mx-4 sm:px-4 scrollbar-none">
          <Link to="/shop" className="px-4 py-2 rounded-full text-sm font-semibold border border-border bg-white hover:bg-brand-light/40 shrink-0 transition-colors">সব</Link>
          {categories.map((c) => (
            <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className={`px-4 py-2 rounded-full text-sm font-semibold border shrink-0 transition-all ${c.slug === slug ? "bg-gradient-to-r from-brand to-brand-dark text-white border-transparent shadow-md shadow-brand/20" : "bg-white hover:bg-brand-light/40 border-border"}`}>
              {c.name}
            </Link>
          ))}
        </div>

        <header className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-light/45 px-3 py-1 text-xs sm:text-sm font-semibold text-brand-dark mb-2"><Leaf className="w-3.5 h-3.5" />ক্যাটাগরি</div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-brand-dark">{cat?.name ?? "ক্যাটাগরি"}</h1>
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">আপনার পছন্দের পণ্য খুঁজে নিতে নিচের সাব-ক্যাটাগরি থেকে বেছে নিন।</p>
        </header>

        {children.length > 0 && (
          <section className="mb-9 sm:mb-11">
            <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
              <div><h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">সাব-ক্যাটাগরি</h2><p className="text-xs sm:text-sm text-muted-foreground mt-1">এক ক্লিকেই নির্দিষ্ট পণ্যের তালিকায় যান</p></div>
              <span className="hidden sm:inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{children.length} টি</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {children.map((child) => (
                <Link key={child.id} to="/category/$slug" params={{ slug: child.slug }} className="group relative overflow-hidden rounded-2xl border border-border/80 bg-white p-2 sm:p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50">
                  <div className="relative aspect-[1.08/1] overflow-hidden rounded-xl bg-gradient-to-br from-brand-light/45 via-muted to-white">
                    {child.image_url ? (
                      <img src={child.image_url} alt={child.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><span className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-white/90 shadow-sm text-brand"><Leaf className="h-7 w-7 sm:h-8 sm:w-8" /></span></div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent opacity-70" />
                    <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand shadow-sm backdrop-blur transition-all group-hover:bg-brand group-hover:text-white"><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                  </div>
                  <div className="px-1 py-2 sm:py-2.5"><h3 className="text-sm sm:text-base font-bold text-brand-dark leading-snug line-clamp-2">{child.name}</h3><div className="mt-1.5 text-[11px] sm:text-xs font-semibold text-brand opacity-90">পণ্য দেখুন →</div></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {products.length > 0 ? (
          <section>
            <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5"><div><h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">পণ্যসমূহ</h2><p className="text-xs sm:text-sm text-muted-foreground mt-1">এই ক্যাটাগরির উপলব্ধ পণ্য</p></div></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 text-center py-12 sm:py-16 text-muted-foreground"><Leaf className="mx-auto h-8 w-8 mb-2 opacity-50" /><p className="font-semibold">কোনো পণ্য নেই</p></div>
        )}
      </div>
    </SiteLayout>
  );
}
