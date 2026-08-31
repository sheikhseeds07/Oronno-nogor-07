alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.orders add column if not exists confirmed_by uuid;

create index if not exists idx_orders_web_confirmed_at
  on public.orders (confirmed_at)
  where confirmed_at is not null;

create or replace function public.record_web_order_confirmation(p_order_id uuid, p_confirmed_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_order_id is null or p_confirmed_by is null then
    raise exception 'Invalid confirmation tracking payload';
  end if;

  update public.orders
  set confirmed_at = coalesce(confirmed_at, now()),
      confirmed_by = coalesce(confirmed_by, p_confirmed_by)
  where id = p_order_id
    and source::text = 'web'
    and status::text <> 'web_pending';

  if not found then
    raise exception 'Web order confirmation tracking failed';
  end if;
end;
$$;

revoke all on function public.record_web_order_confirmation(uuid, uuid) from public;
