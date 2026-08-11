import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";
import { fallbackCategories, fallbackProducts } from "@/lib/fallback-shop";

export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = useParams({ from: "/category/$slug" });

  const { data: categories = fallbackCategories } = useQuery({
    queryKey: ["cat-list"],
    initialData: fallbackCategories,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("is_hidden_from_home", false).order("display_order");
      if (error?.message?.includes("is_hidden_from_home")) {
        const fallback = await supabase.from("categories").select("*").order("display_order");
        return fallback.data?.length ? fallback.data : fallbackCategories;
      }
      return data?.length ? data : fallbackCategories;
    },
  });

  const { data: cat } = useQuery({
    queryKey: ["cat", slug],
    initialData: () => {
      const c = fallbackCategories.find((item) => item.slug === slug);
      return c ? { id: c.id, name: c.name, slug: c.slug, image_url: c.image_url, display_order: c.display_order, created_at: "", is_hidden_from_home: false } : null;
    },
    queryFn: async () => (await supabase.from("categories").select("*").eq("slug", slug).maybeSingle()).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["cat-products", slug],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories!inner(slug)").eq("is_active", true).eq("categories.slug", slug).order("created_at", { ascending: false });
      if (data && data.length > 0) return data as unknown as Product[];
      // Only fall back to demo data when DB has no real products at all
      const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true);
      if ((count ?? 0) === 0) return fallbackProducts.filter((p) => p.category_slug === slug) as Product[];
      return [];
    },
  });

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-6">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-3 px-3">
          <Link to="/shop" className="px-4 py-1.5 rounded-full text-sm font-semibold border bg-white hover:bg-brand-light/40 shrink-0">সব</Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border shrink-0 transition ${c.slug === slug ? "bg-gradient-to-r from-brand to-brand-dark text-white border-transparent shadow" : "bg-white hover:bg-brand-light/40"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <h1 className="text-2xl font-bold mb-4">{cat?.name ?? "ক্যাটাগরি"}</h1>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">কোনো পণ্য নেই</div>
        )}
      </div>
    </SiteLayout>
  );
}
