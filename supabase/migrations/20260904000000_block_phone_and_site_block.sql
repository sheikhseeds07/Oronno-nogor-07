-- Customer block: phone number + IP, and a site-wide block check.
-- Safe to re-run.

-- 1) Table (no-op when it already exists)
create table if not exists public.customer_blocks (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  ip_address text,
  is_active boolean not null default true,
  blocked_at timestamptz not null default now(),
  unblocked_at timestamptz,
  blocked_by text
);

alter table public.customer_blocks add column if not exists phone text;
alter table public.customer_blocks add column if not exists customer_name text;
alter table public.customer_blocks add column if not exists ip_address text;
alter table public.customer_blocks add column if not exists blocked_by text;

create index if not exists customer_blocks_phone_active_idx on public.customer_blocks (phone) where is_active;
create index if not exists customer_blocks_ip_active_idx on public.customer_blocks (ip_address) where is_active;

grant select, insert, update on public.customer_blocks to authenticated;
grant all on public.customer_blocks to service_role;
alter table public.customer_blocks enable row level security;

-- 2) Phone normalizer (01XXXXXXXXX)
create or replace function public.normalize_bd_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when p_phone is null then null
    else (
      with d as (select regexp_replace(p_phone, '[^0-9]', '', 'g') as v)
      select case when v like '8801%' then substr(v, 3, 11) else left(v, 11) end from d
    )
  end
$$;

-- 3) Block / unblock / list
drop function if exists public.block_customer(text, text);
drop function if exists public.block_customer(text, text, text);

create or replace function public.block_customer(p_phone text, p_ip text, p_name text default null)
returns setof public.customer_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_bd_phone(p_phone);
  v_row public.customer_blocks;
begin
  if v_phone is null and p_ip is null then
    raise exception 'phone or ip required';
  end if;

  select * into v_row
  from public.customer_blocks
  where (v_phone is not null and phone = v_phone)
     or (p_ip is not null and ip_address = p_ip)
  order by blocked_at desc
  limit 1;

  if v_row.id is not null then
    update public.customer_blocks
       set is_active = true,
           unblocked_at = null,
           blocked_at = now(),
           phone = coalesce(v_phone, phone),
           ip_address = coalesce(p_ip, ip_address),
           customer_name = coalesce(p_name, customer_name),
           blocked_by = coalesce(auth.email(), blocked_by, 'Admin')
     where id = v_row.id
     returning * into v_row;
  else
    insert into public.customer_blocks (customer_name, phone, ip_address, is_active, blocked_by)
    values (p_name, v_phone, p_ip, true, coalesce(auth.email(), 'Admin'))
    returning * into v_row;
  end if;

  return next v_row;
end
$$;

create or replace function public.unblock_customer(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.customer_blocks
     set is_active = false, unblocked_at = now()
   where id = p_id
$$;

drop function if exists public.list_customer_blocks();

create or replace function public.list_customer_blocks()
returns table (
  id uuid,
  customer_name text,
  phone text,
  ip_address text,
  is_active boolean,
  blocked_at timestamptz,
  unblocked_at timestamptz,
  blocked_by text
)
language sql
security definer
set search_path = public
as $$
  select id, customer_name, phone, ip_address, is_active, blocked_at, unblocked_at, blocked_by
  from public.customer_blocks
  order by is_active desc, blocked_at desc
$$;

-- 4) Site-wide / checkout block check (public)
create or replace function public.is_blocked_visitor(p_ip text default null, p_phone text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_blocks b
    where b.is_active
      and (
        (p_ip is not null and b.ip_address = p_ip)
        or (p_phone is not null and b.phone = public.normalize_bd_phone(p_phone))
      )
  )
$$;

grant execute on function public.is_blocked_visitor(text, text) to anon, authenticated, service_role;
grant execute on function public.list_customer_blocks() to authenticated, service_role;
grant execute on function public.block_customer(text, text, text) to authenticated, service_role;
grant execute on function public.unblock_customer(uuid) to authenticated, service_role;
