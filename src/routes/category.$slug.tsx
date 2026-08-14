import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { ProductCard, type Product } from "@/components/shop/ProductCard";
import { supabase } from "@/lib/personal-supabase/client";

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
      <div className="container mx-auto px-3 py-6">
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

        {children.length > 0 && (
          <section className="mb-7">
            <h2 className="font-bold text-lg mb-3">সাব-ক্যাটাগরি</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {children.map((child) => (
                <Link
                  key={child.id}
                  to="/category/$slug"
                  params={{ slug: child.slug }}
                  className="bg-white border rounded-xl p-3 hover:border-brand/40 hover:shadow-md transition text-center"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                    {child.image_url ? (
                      <img src={child.image_url} alt={child.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🌱</div>
                    )}
                  </div>
                  <div className="font-semibold text-sm">{child.name}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

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
