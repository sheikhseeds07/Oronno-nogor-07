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

type ProductWithCategory = HomeProduct & {
  categories?: { is_hidden_from_home?: boolean } | null;
};

const PRODUCT_COLS = "id,slug,name,price,sale_price,images,stock,is_featured";

function visibleProducts(rows: ProductWithCategory[]) {
  return rows
    .filter((product) => !product.categories?.is_hidden_from_home)
    .map(({ categories: _category, ...product }) => product as HomeProduct);
}

/**
 * Fetch all home-page data. Categories are admin-controlled root categories.
 * Popular products are ranked by real sold quantity first; recent active
 * products only fill any remaining slots after the best sellers.
 */
export const getHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const categoriesQuery = (supabase.from("categories") as any)
    .select("id,slug,name,image_url")
    .is("parent_id", null)
    .eq("is_hidden_from_home", false)
    .order("display_order")
    .order("created_at");

  const [bannersRes, categoriesRes, topSellersRes] = await Promise.all([
    supabase
      .from("banners")
      .select("id,title,image_url,link_url")
      .eq("is_active", true)
      .order("display_order")
      .limit(8),
    categoriesQuery,
    (supabase.from("top_selling_products" as never) as any)
      .select("product_id,units_sold,order_count")
      .order("units_sold", { ascending: false })
      .order("order_count", { ascending: false })
      .limit(24),
  ]);

  const banners = (bannersRes.data ?? []) as HomeBanner[];
  const categories = (categoriesRes.data ?? []) as HomeCategory[];
  const topIds = ((topSellersRes.data ?? []) as Array<{ product_id: string }>)
    .map((row) => row.product_id)
    .filter(Boolean);

  let products: HomeProduct[] = [];

  if (topIds.length) {
    const { data: topProductRows } = await supabase
      .from("products")
      .select(`${PRODUCT_COLS}, categories!left(is_hidden_from_home)`)
      .eq("is_active", true)
      .in("id", topIds);

    const order = new Map(topIds.map((id, index) => [id, index]));
    products = visibleProducts((topProductRows ?? []) as ProductWithCategory[])
      .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 12);
  }

  if (products.length < 12) {
    const { data: recentRows } = await supabase
      .from("products")
      .select(`${PRODUCT_COLS}, categories!left(is_hidden_from_home)`)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(40);

    const alreadyIncluded = new Set(products.map((product) => product.id));
    const fillers = visibleProducts((recentRows ?? []) as ProductWithCategory[])
      .filter((product) => !alreadyIncluded.has(product.id));

    products = [...products, ...fillers].slice(0, 12);
  }

  return { banners, categories, products };
});
