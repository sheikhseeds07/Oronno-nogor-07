drop materialized view if exists public.top_selling_products;

create view public.top_selling_products
with (security_invoker = true)
as
with resolved_items as (
  select
    oi.order_id,
    oi.quantity,
    coalesce(
      oi.product_id,
      (
        select p.id
        from public.products p
        where p.is_active = true
          and (
            lower(p.name) = lower(oi.product_name)
            or lower(p.name) like '%' || lower(oi.product_name) || '%'
            or lower(oi.product_name) like '%' || lower(p.name) || '%'
          )
        order by
          case when lower(p.name) = lower(oi.product_name) then 0 else 1 end,
          abs(length(p.name) - length(oi.product_name)),
          p.created_at desc
        limit 1
      )
    ) as product_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status::text in ('pending', 'rts', 'shipped', 'delivered', 'partial')
)
select
  product_id,
  sum(quantity)::bigint as units_sold,
  count(distinct order_id)::bigint as order_count
from resolved_items
where product_id is not null
group by product_id
order by units_sold desc, order_count desc, product_id;

grant select on public.top_selling_products to anon, authenticated;

create or replace function public.restore_deleted_orders(p_ids uuid[], p_status public.order_status)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_restored integer := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  for v_id in
    select id
    from public.deleted_orders
    where id = any(p_ids)
    order by deleted_at
  loop
    perform public.restore_deleted_order(v_id, p_status);
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

create or replace function public.permanently_delete_archived_orders(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  delete from public.deleted_orders
  where id = any(p_ids);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.restore_deleted_orders(uuid[], public.order_status) from public, anon, authenticated;
revoke all on function public.permanently_delete_archived_orders(uuid[]) from public, anon, authenticated;
grant execute on function public.restore_deleted_orders(uuid[], public.order_status) to service_role;
grant execute on function public.permanently_delete_archived_orders(uuid[]) to service_role;
