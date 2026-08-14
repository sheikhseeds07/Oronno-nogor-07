import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): { q?: string; cat?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  component: Shop,
});

type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

function Shop() {
  const { q, cat } = useSearch({ from: "/shop" });

  const { data: categories = [] } = useQuery({
    queryKey: ["shop-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("categories") as any)
        .select("id,name,slug,parent_id")
        .is("parent_id", null)
        .eq("is_hidden_from_home", false)
        .order("display_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ShopCategory[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products", q, cat],
    queryFn: async () => {
      let categoryIds: string[] | null = null;
      if (cat) {
        const { data: selected, error: selectedError } = await (supabase.from("categories") as any)
          .select("id")
          .eq("slug", cat)
          .maybeSingle();
        if (selectedError) throw selectedError;
        if (!selected?.id) return [];

        const { data: children, error: childError } = await (supabase.from("categories") as any)
          .select("id")
          .eq("parent_id", selected.id);
        if (childError) throw childError;
        categoryIds = [selected.id, ...((children ?? []) as Array<{ id: string }>).map((c) => c.id)];
      }

      let query = supabase.from("products").select("*").eq("is_active", true);
      if (categoryIds) query = query.in("category_id", categoryIds);
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  const activeCat = categories.find((c) => c.slug === cat);

  return (
    <SiteLayout>
      <div className="container mx-auto px-3 py-5">
        <div className="bg-white border rounded-2xl p-2 mb-5 shadow-sm">
          <div className="flex gap-1.5 overflow-x-auto">
            <Link
              to="/shop"
              className={`px-4 py-2 rounded-xl text-sm font-bold shrink-0 transition ${!cat ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow" : "text-foreground hover:bg-brand-light/40"}`}
            >
              সব পণ্য
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ cat: c.slug } as never}
                className={`px-4 py-2 rounded-xl text-sm font-bold shrink-0 transition ${cat === c.slug ? "bg-gradient-to-r from-brand to-brand-dark text-white shadow" : "text-foreground hover:bg-brand-light/40"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-brand-dark">
            {q ? `"${q}" এর ফলাফল` : activeCat ? activeCat.name : "সকল পণ্য"}
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
