create or replace function public.get_home_data_v1() returns jsonb language sql stable set search_path to '' as $function$
with root_categories as materialized (
  select c.id,c.slug,c.name,c.image_url,c.display_order,c.created_at
  from public.categories c
  where c.parent_id is null and coalesce(c.is_hidden_from_home,false)=false
  order by c.display_order,c.created_at
),
home_products as materialized (
  select p.id,p.slug,p.name,p.price,p.sale_price,p.images,p.stock,p.is_featured,p.created_at
  from public.products p
  where p.is_active=true and p.is_popular=true and coalesce(p.is_offer,false)=false and coalesce(p.is_archived,false)=false
  order by p.created_at desc limit 12
)
select jsonb_build_object(
  'banners',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'image_url',b.image_url,'link_url',b.link_url) order by b.display_order,b.created_at) from public.banners b where b.is_active=true),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name,'image_url',c.image_url) order by c.display_order,c.created_at) from root_categories c),'[]'::jsonb),
  'subcategories','[]'::jsonb,
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'price',p.price,'sale_price',p.sale_price,'images',to_jsonb(p.images),'stock',p.stock,'is_featured',p.is_featured) order by p.created_at desc) from home_products p),'[]'::jsonb)
);
$function$;
