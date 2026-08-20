create or replace function public.archive_orders(p_ids uuid[], p_deleted_by uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived integer := 0;
  v_actor uuid := auth.uid();
  v_request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_deleted_by uuid;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  if v_actor is null then
    if v_request_role <> 'service_role' then
      raise exception 'Unauthorized' using errcode = '42501';
    end if;
    v_deleted_by := p_deleted_by;
  else
    if not (public.is_admin(v_actor) or public.has_permission(v_actor, 'orders')) then
      raise exception 'Unauthorized' using errcode = '42501';
    end if;
    v_deleted_by := v_actor;
  end if;

  insert into public.deleted_orders (
    id, invoice_no, original_status, customer_name, customer_phone, total,
    original_created_at, deleted_at, deleted_by, order_data, items, status_logs
  )
  select
    o.id,
    o.invoice_no,
    o.status::text,
    o.customer_name,
    o.customer_phone,
    o.total,
    o.created_at,
    now(),
    v_deleted_by,
    to_jsonb(o),
    coalesce((
      select jsonb_agg(to_jsonb(oi) order by oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(osl) order by osl.created_at, osl.id)
      from public.order_status_logs osl
      where osl.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  where o.id = any(p_ids)
  on conflict (id) do update set
    invoice_no = excluded.invoice_no,
    original_status = excluded.original_status,
    customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    total = excluded.total,
    original_created_at = excluded.original_created_at,
    deleted_at = excluded.deleted_at,
    deleted_by = excluded.deleted_by,
    order_data = excluded.order_data,
    items = excluded.items,
    status_logs = excluded.status_logs;

  get diagnostics v_archived = row_count;

  delete from public.orders o
  where o.id = any(p_ids)
    and exists (select 1 from public.deleted_orders d where d.id = o.id);

  return v_archived;
end;
$$;

revoke execute on function public.archive_orders(uuid[], uuid) from public, anon;
grant execute on function public.archive_orders(uuid[], uuid) to authenticated, service_role;

create or replace function public.cancel_orders(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cancelled integer := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  if v_actor is null or not (public.is_admin(v_actor) or public.has_permission(v_actor, 'orders')) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  update public.orders
  set status = 'cancelled'::public.order_status,
      assigned_to = v_actor
  where id = any(p_ids)
    and status is distinct from 'cancelled'::public.order_status;

  get diagnostics v_cancelled = row_count;
  return v_cancelled;
end;
$$;

revoke execute on function public.cancel_orders(uuid[]) from public, anon;
grant execute on function public.cancel_orders(uuid[]) to authenticated;