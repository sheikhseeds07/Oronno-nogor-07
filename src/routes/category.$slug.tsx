import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { ChevronDown, Leaf } from "lucide-react";

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
        {/* Main categories: compact, clean and always visible at the top */}
        <nav className="-mx-3 px-3 sm:-mx-4 sm:px-4 overflow-x-auto scrollbar-none pb-1" aria-label="প্রধান ক্যাটাগরি">
          <div className="flex min-w-max items-center gap-2">
            <Link
              to="/shop"
              className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-all hover:border-brand/30 hover:bg-brand-light/30"
            >
              সব
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                  c.slug === slug
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-border bg-white text-foreground hover:border-brand/30 hover:bg-brand-light/30"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>

        {/* Active main category opens its subcategory selector underneath */}
        {cat && children.length > 0 && (
          <section className="mt-5 rounded-2xl border border-brand/15 bg-brand-light/20 p-3 sm:p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h1 className="text-base sm:text-lg font-extrabold text-brand-dark">{cat.name}</h1>
              <ChevronDown className="h-4 w-4 text-brand" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {children.map((child) => (
                <Link
                  key={child.id}
                  to="/category/$slug"
                  params={{ slug: child.slug }}
                  className="group flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white bg-white px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-brand/30 hover:bg-brand-light/30 active:scale-[0.98]"
                >
                  <span className="line-clamp-1">{child.name}</span>
                  <span className="shrink-0 text-brand opacity-60 transition-transform group-hover:translate-x-0.5">›</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {cat && children.length === 0 && (
          <header className="mt-6 mb-5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-dark">{cat.name}</h1>
          </header>
        )}

        {products.length > 0 ? (
          <section className={cat && children.length > 0 ? "mt-7" : "mt-5"}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-extrabold text-brand-dark">পণ্যসমূহ</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </section>
        ) : (
          <div className="mt-7 rounded-2xl border border-dashed border-border bg-muted/30 py-12 text-center text-muted-foreground">
            <Leaf className="mx-auto mb-2 h-7 w-7 opacity-50" />
            <p className="font-semibold">কোনো পণ্য নেই</p>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
