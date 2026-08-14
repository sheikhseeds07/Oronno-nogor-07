create table if not exists public.deleted_orders (
  id uuid primary key,
  invoice_no text,
  original_status text not null,
  customer_name text not null,
  customer_phone text not null,
  total numeric not null default 0,
  original_created_at timestamptz not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  order_data jsonb not null,
  items jsonb not null default '[]'::jsonb,
  status_logs jsonb not null default '[]'::jsonb
);

create index if not exists deleted_orders_deleted_at_idx on public.deleted_orders (deleted_at desc);
create index if not exists deleted_orders_phone_idx on public.deleted_orders (customer_phone);
create index if not exists deleted_orders_invoice_idx on public.deleted_orders (invoice_no);

alter table public.deleted_orders enable row level security;
revoke all on table public.deleted_orders from anon, authenticated;

create or replace function public.archive_orders(p_ids uuid[], p_deleted_by uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived integer := 0;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
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
    p_deleted_by,
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

create or replace function public.restore_deleted_order(p_id uuid, p_status public.order_status)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.deleted_orders%rowtype;
begin
  select * into d
  from public.deleted_orders
  where id = p_id
  for update;

  if not found then
    raise exception 'Deleted order not found';
  end if;

  if exists (select 1 from public.orders where id = p_id) then
    raise exception 'Order already exists';
  end if;

  insert into public.orders
  select (jsonb_populate_record(null::public.orders, d.order_data)).*;

  update public.orders
  set status = p_status,
      updated_at = now()
  where id = p_id;

  insert into public.order_items (id, order_id, product_id, product_name, quantity, price, subtotal)
  select
    x.id,
    p_id,
    case when x.product_id is null or p.id is not null then x.product_id else null end,
    x.product_name,
    x.quantity,
    x.price,
    x.subtotal
  from jsonb_to_recordset(d.items) as x(
    id uuid,
    order_id uuid,
    product_id uuid,
    product_name text,
    quantity integer,
    price numeric,
    subtotal numeric
  )
  left join public.products p on p.id = x.product_id;

  insert into public.order_status_logs (id, order_id, from_status, to_status, changed_by, note, created_at)
  select
    x.id,
    p_id,
    x.from_status,
    x.to_status,
    x.changed_by,
    x.note,
    x.created_at
  from jsonb_to_recordset(d.status_logs) as x(
    id uuid,
    order_id uuid,
    from_status public.order_status,
    to_status public.order_status,
    changed_by uuid,
    note text,
    created_at timestamptz
  );

  delete from public.deleted_orders where id = p_id;
  return true;
end;
$$;

create or replace function public.permanently_delete_archived_order(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.deleted_orders where id = p_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.archive_orders(uuid[], uuid) from public, anon, authenticated;
revoke all on function public.restore_deleted_order(uuid, public.order_status) from public, anon, authenticated;
revoke all on function public.permanently_delete_archived_order(uuid) from public, anon, authenticated;
grant execute on function public.archive_orders(uuid[], uuid) to service_role;
grant execute on function public.restore_deleted_order(uuid, public.order_status) to service_role;
grant execute on function public.permanently_delete_archived_order(uuid) to service_role;