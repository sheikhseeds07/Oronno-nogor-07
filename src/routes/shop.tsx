import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: Shop,
});

function Shop() {
  const { q } = useSearch({ from: "/shop" });

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products", q],
    queryFn: async () => {
      // /shop is the All Products page: never apply a category filter here.
      let query = supabase.from("products").select("*").eq("is_active", true);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-5">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
            {q ? `"${q}" এর ফলাফল` : "সকল পণ্য"}
          </h1>
          <span className="text-xs text-muted-foreground">{products.length} টি পণ্য</span>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</div>
        )}
      </div>
    </SiteLayout>
  );
}
