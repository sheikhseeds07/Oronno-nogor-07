alter table public.products
  add column if not exists is_popular boolean not null default false;

create index if not exists products_popular_home_idx
  on public.products (is_popular, is_active, created_at desc);

update public.products p
set is_popular = true
where exists (
  select 1 from public.top_selling_products t where t.product_id = p.id
);

create or replace function public.get_home_data_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with home_products as materialized (
    select
      p.id,
      p.slug,
      p.name,
      p.price,
      p.sale_price,
      p.images,
      p.stock,
      p.is_featured,
      p.created_at
    from public.products p
    where p.is_active = true
      and p.is_popular = true
    order by p.created_at desc
    limit 12
  )
  select jsonb_build_object(
    'banners', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'title', b.title,
          'image_url', b.image_url,
          'link_url', b.link_url
        ) order by b.display_order, b.created_at
      )
      from public.banners b
      where b.is_active = true
    ), '[]'::jsonb),
    'categories', '[]'::jsonb,
    'subcategories', '[]'::jsonb,
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'slug', p.slug,
          'name', p.name,
          'price', p.price,
          'sale_price', p.sale_price,
          'images', to_jsonb(p.images),
          'stock', p.stock,
          'is_featured', p.is_featured
        ) order by p.created_at desc
      )
      from home_products p
    ), '[]'::jsonb)
  );

revoke all on function public.get_home_data_v1() from public;
grant execute on function public.get_home_data_v1() to anon, authenticated;
