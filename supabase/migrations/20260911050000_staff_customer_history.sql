-- Our Record: site-wide customer history for any staff member, regardless of
-- order assignment or source. SECURITY DEFINER bypasses per-employee RLS.
create or replace function public.staff_customer_history(_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  last9 text;
  result jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid()) then
    return '[]'::jsonb;
  end if;

  last9 := right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 9);
  if length(last9) < 9 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb)
    into result
  from (
    select
      o.id, o.invoice_no, o.status, o.total, o.created_at,
      o.customer_name, o.customer_phone, o.customer_address,
      o.thana, o.district, o.source,
      coalesce((
        select jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity))
        from public.order_items oi where oi.order_id = o.id
      ), '[]'::jsonb) as order_items
    from public.orders o
    where right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9) = last9
    order by o.created_at desc
    limit 200
  ) t;

  return result;
end;
$$;

revoke all on function public.staff_customer_history(text) from public;
grant execute on function public.staff_customer_history(text) to authenticated;
grant execute on function public.staff_customer_history(text) to service_role;
