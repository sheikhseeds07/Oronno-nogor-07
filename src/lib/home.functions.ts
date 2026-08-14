import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type HomeBanner = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
};

export type HomeCategory = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
};

export type HomeProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  images: string[];
  stock: number;
  is_featured: boolean;
};

export type HomeData = {
  banners: HomeBanner[];
  categories: HomeCategory[];
  products: HomeProduct[];
};

/**
 * Fetches all data needed for the home page in parallel on the server.
 * Home categories are always controlled by the admin: only visible root
 * categories are returned. Subcategories never appear as separate home items.
 */
export const getHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const cols = "id,slug,name,price,sale_price,images,stock,is_featured";
  const categoriesQuery = (supabase.from("categories") as any)
    .select("id,slug,name,image_url")
    .is("parent_id", null)
    .eq("is_hidden_from_home", false)
    .order("display_order")
    .order("created_at");

  const [bannersRes, categoriesRes, topSellersRes] = await Promise.all([
    supabase.from("banners").select("id,title,image_url,link_url").eq("is_active", true).order("display_order").limit(8),
    categoriesQuery,
    supabase.from("top_selling_products" as never).select("product_id").limit(24),
  ]);

  const banners = (bannersRes.data ?? []) as HomeBanner[];
  const categories = (categoriesRes.data ?? []) as HomeCategory[];
  const topIds = ((topSellersRes.data ?? []) as Array<{ product_id: string }>).map((r) => r.product_id).filter(Boolean);

  let products: HomeProduct[] = [];

  if (topIds.length) {
    const { data } = await supabase
      .from("products")
      .select(`${cols}, categories!left(is_hidden_from_home)`)
      .eq("is_active", true)
      .in("id", topIds);
    const order = new Map(topIds.map((id, i) => [id, i]));
    products = ((data ?? []) as Array<HomeProduct & { categories?: { is_hidden_from_home?: boolean } | null }>)
      .filter((p) => !p.categories?.is_hidden_from_home)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .slice(0, 12)
      .map(({ categories: _c, ...rest }) => rest as HomeProduct);
  }

  if (!products.length) {
    const { data: lps } = await supabase.from("landing_pages").select("product_id");
    const excludeIds = new Set(((lps ?? []) as Array<{ product_id: string | null }>).map((r) => r.product_id).filter(Boolean) as string[]);
    let q = supabase
      .from("products")
      .select(`${cols}, categories!left(is_hidden_from_home)`)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(24);
    if (excludeIds.size) q = q.not("id", "in", `(${Array.from(excludeIds).join(",")})`);
    const { data } = await q;
    products = ((data ?? []) as Array<HomeProduct & { categories?: { is_hidden_from_home?: boolean } | null }>)
      .filter((p) => !p.categories?.is_hidden_from_home)
      .slice(0, 12)
      .map(({ categories: _c, ...rest }) => rest as HomeProduct);
  }

  return { banners, categories, products };
});
