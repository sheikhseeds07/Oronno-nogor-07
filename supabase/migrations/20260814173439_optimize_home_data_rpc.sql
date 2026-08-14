create or replace function public.get_home_data_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with visible_roots as materialized (
    select c.id, c.slug, c.name, c.image_url, c.display_order, c.created_at
    from public.categories c
    where c.parent_id is null
      and c.is_hidden_from_home = false
  ),
  home_products as materialized (
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
    left join public.categories c on c.id = p.category_id
    where p.is_active = true
      and coalesce(c.is_hidden_from_home, false) = false
      and not exists (
        select 1
        from public.landing_pages lp
        where lp.product_id = p.id
      )
    order by p.is_featured desc, p.created_at desc
    limit 12
  )
  select jsonb_build_object(
    'banners',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'image_url', b.image_url,
            'link_url', b.link_url
          )
          order by b.display_order, b.created_at
        )
        from public.banners b
        where b.is_active = true
      ), '[]'::jsonb),
    'categories',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'slug', r.slug,
            'name', r.name,
            'image_url', r.image_url
          )
          order by r.display_order, r.created_at
        )
        from visible_roots r
      ), '[]'::jsonb),
    'subcategories',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'slug', c.slug,
            'name', c.name,
            'image_url', c.image_url,
            'parent_id', c.parent_id
          )
          order by c.parent_id, c.display_order, c.created_at
        )
        from public.categories c
        where c.parent_id in (select r.id from visible_roots r)
      ), '[]'::jsonb),
    'products',
      coalesce((
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
          )
          order by p.is_featured desc, p.created_at desc
        )
        from home_products p
      ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_home_data_v1() from public;
grant execute on function public.get_home_data_v1() to anon, authenticated;
