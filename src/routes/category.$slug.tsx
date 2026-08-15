import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { Leaf, ChevronRight } from "lucide-react";

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
        {/* Main categories keep the image-based visual style; homepage is untouched. */}
        <nav className="-mx-3 px-3 sm:-mx-4 sm:px-4 overflow-x-auto scrollbar-none pb-1" aria-label="প্রধান ক্যাটাগরি">
          <div className="flex min-w-max items-center gap-2.5 sm:gap-3">
            <Link to="/shop" className="shrink-0 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-foreground transition-all hover:border-brand/30 hover:bg-brand-light/30">সব</Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`group shrink-0 flex items-center gap-2 rounded-2xl border px-2.5 py-2 transition-all ${c.slug === slug ? "border-brand bg-brand text-white shadow-md" : "border-border bg-white text-foreground hover:border-brand/30 hover:bg-brand-light/30"}`}
              >
                <span className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 overflow-hidden rounded-xl bg-brand-light/50 ring-1 ring-black/5">
                  {c.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center text-brand">🌱</span>}
                </span>
                <span className="pr-1 text-sm font-bold">{c.name}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Selected main category has its image; subcategories stay compact text-only pills. */}
        {cat && children.length > 0 && (
          <section className="mt-5 rounded-2xl border border-brand/15 bg-brand-light/15 p-3.5 sm:p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand/10">
                {cat.image_url ? <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="eager" /> : <div className="flex h-full w-full items-center justify-center text-brand text-xl">🌱</div>}
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-brand-dark">{cat.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <Link
                  key={child.id}
                  to="/category/$slug"
                  params={{ slug: child.slug }}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-brand hover:bg-brand hover:text-white active:scale-[0.98]"
                >
                  <span className="line-clamp-1">{child.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {cat && children.length === 0 && (
          <header className="mt-5 mb-5 flex items-center gap-3">
            <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-2xl bg-brand-light/30 ring-1 ring-brand/10">
              {cat.image_url ? <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" loading="eager" /> : <div className="flex h-full w-full items-center justify-center text-brand text-xl">🌱</div>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark">{cat.name}</h1>
          </header>
        )}

        {products.length > 0 ? (
          <section className={cat && children.length > 0 ? "mt-7" : "mt-5"}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">পণ্যসমূহ</h2></div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center text-muted-foreground"><Leaf className="mx-auto mb-2 h-7 w-7 opacity-50" /><p className="font-semibold">কোনো পণ্য নেই</p></div>
        )}
      </div>
    </SiteLayout>
  );
}
