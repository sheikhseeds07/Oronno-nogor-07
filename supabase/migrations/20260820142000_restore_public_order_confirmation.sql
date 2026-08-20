create or replace function public.get_public_order_confirmation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'customer_name', o.customer_name,
    'customer_phone', case
      when o.customer_phone is null then ''
      when length(o.customer_phone) <= 3 then o.customer_phone
      else repeat('*', greatest(length(o.customer_phone) - 3, 0)) || right(o.customer_phone, 3)
    end,
    'thana', o.thana,
    'district', o.district,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'created_at', o.created_at,
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'price', oi.price,
        'subtotal', oi.subtotal
      ) order by oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_id
  limit 1;
$$;

revoke all on function public.get_public_order_confirmation(uuid) from public;
grant execute on function public.get_public_order_confirmation(uuid) to anon, authenticated, service_role;
