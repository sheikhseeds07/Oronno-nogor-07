create table if not exists public.courier_edge_throttle (
  id smallint primary key check (id = 1),
  next_allowed_at timestamptz not null default clock_timestamp()
);

alter table public.courier_edge_throttle enable row level security;
revoke all on table public.courier_edge_throttle from anon, authenticated;

create or replace function public.reserve_courier_edge_slot(p_gap_ms integer default 1500)
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
  insert into public.courier_edge_throttle (id, next_allowed_at)
  values (1, v_now)
  on conflict (id) do nothing;

  select next_allowed_at
    into v_next
  from public.courier_edge_throttle
  where id = 1
  for update;

  v_slot := greatest(v_now, v_next);
  v_wait_ms := greatest(0, ceil(extract(epoch from (v_slot - v_now)) * 1000)::integer);

  update public.courier_edge_throttle
  set next_allowed_at = v_slot + (greatest(500, least(p_gap_ms, 5000)) * interval '1 millisecond')
  where id = 1;

  return v_wait_ms;
end;
$$;

revoke all on function public.reserve_courier_edge_slot(integer) from public, anon, authenticated;
grant execute on function public.reserve_courier_edge_slot(integer) to service_role;
