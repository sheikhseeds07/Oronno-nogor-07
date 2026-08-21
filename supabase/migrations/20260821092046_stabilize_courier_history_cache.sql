create table if not exists public.courier_history_cache (
  phone text primary key,
  configured boolean not null default false,
  stats jsonb not null default '[]'::jsonb,
  error text,
  steadfast_source text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now()
);

alter table public.courier_history_cache enable row level security;

create table if not exists public.courier_provider_throttle (
  id smallint primary key check (id = 1),
  next_allowed_at timestamptz not null default now()
);

insert into public.courier_provider_throttle (id, next_allowed_at)
values (1, now())
on conflict (id) do nothing;

alter table public.courier_provider_throttle enable row level security;

create or replace function public.reserve_courier_provider_slot(p_gap_ms integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_slot timestamptz;
  v_wait_ms integer;
begin
  insert into public.courier_provider_throttle (id, next_allowed_at)
  values (1, v_now)
  on conflict (id) do nothing;

  select next_allowed_at
    into v_next
  from public.courier_provider_throttle
  where id = 1
  for update;

  v_slot := greatest(v_now, v_next);
  v_wait_ms := greatest(0, ceil(extract(epoch from (v_slot - v_now)) * 1000)::integer);

  update public.courier_provider_throttle
  set next_allowed_at = v_slot + (greatest(50, least(p_gap_ms, 2000)) * interval '1 millisecond')
  where id = 1;

  return v_wait_ms;
end;
$$;

revoke all on function public.reserve_courier_provider_slot(integer) from public, anon, authenticated;
grant execute on function public.reserve_courier_provider_slot(integer) to service_role;
