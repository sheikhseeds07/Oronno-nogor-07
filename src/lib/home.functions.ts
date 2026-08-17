import { supabase } from "@/integrations/supabase/client";

export type HomeBanner = { id: string; title: string | null; image_url: string; link_url: string | null };
export type HomeCategory = { id: string; slug: string; name: string; image_url: string | null };
export type HomeSubcategory = HomeCategory & { parent_id: string };
export type HomeProduct = { id: string; slug: string; name: string; price: number; sale_price: number | null; images: string[]; stock: number; is_featured: boolean };
export type HomeData = { banners: HomeBanner[]; categories: HomeCategory[]; subcategories: HomeSubcategory[]; products: HomeProduct[] };

async function getHomeDataFallback(): Promise<HomeData> {
  const cols = "id,slug,name,price,sale_price,images,stock,is_featured";
  const [bannersRes, categoriesRes, popularRes] = await Promise.all([
    supabase.from("banners").select("id,title,image_url,link_url").eq("is_active", true).order("display_order").limit(8),
    supabase.from("categories").select("id,slug,name,image_url,parent_id,is_hidden_from_home").order("display_order").order("created_at"),
    supabase.from("products").select(cols).eq("is_active", true).eq("is_popular", true).order("created_at", { ascending: false }).limit(12),
  ]);
  const allCategories = (categoriesRes.data ?? []) as Array<HomeCategory & { parent_id: string | null; is_hidden_from_home: boolean }>;
  const categories = allCategories.filter((c) => c.parent_id === null && !c.is_hidden_from_home).map(({ parent_id: _p, is_hidden_from_home: _h, ...c }) => c);
  const rootIds = new Set(categories.map((c) => c.id));
  const subcategories = allCategories.filter((c) => Boolean(c.parent_id && rootIds.has(c.parent_id))).map(({ is_hidden_from_home: _h, ...c }) => c as HomeSubcategory);
  return { banners: (bannersRes.data ?? []) as HomeBanner[], categories, subcategories, products: (popularRes.data ?? []) as HomeProduct[] };
}

export async function getHomeData(): Promise<HomeData> {
  const { data, error } = (await supabase.rpc("get_home_data_v1" as never)) as { data: unknown; error: { message: string } | null };
  if (!error && data && typeof data === "object") {
    const payload = data as Partial<HomeData>;
    return {
      banners: Array.isArray(payload.banners) ? payload.banners : [],
      categories: Array.isArray(payload.categories) ? payload.categories : [],
      subcategories: Array.isArray(payload.subcategories) ? payload.subcategories : [],
      products: Array.isArray(payload.products) ? payload.products : [],
    };
  }
  console.error("get_home_data_v1 failed; using direct queries", error);
  return getHomeDataFallback();
}
