create table if not exists public.order_rate_limits (
  key_type text not null check (key_type in ('phone','ip')),
  key_value text not null,
  last_order_at timestamptz not null default now(),
  primary key (key_type, key_value)
);

alter table public.order_rate_limits enable row level security;

create or replace function public.check_and_touch_order_rate_limit(
  p_phone text,
  p_ip text,
  p_phone_minutes integer default 0,
  p_ip_minutes integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_phone_last timestamptz;
  v_ip_last timestamptz;
  v_wait integer := 0;
  v_phone_wait integer := 0;
  v_ip_wait integer := 0;
begin
  if p_phone_minutes > 0 then
    select last_order_at into v_phone_last
    from public.order_rate_limits
    where key_type = 'phone' and key_value = p_phone
    for update;

    if v_phone_last is not null then
      v_phone_wait := greatest(0, ceil(extract(epoch from ((v_phone_last + make_interval(mins => p_phone_minutes)) - v_now)) / 60.0)::integer);
    end if;
  end if;

  if p_ip_minutes > 0 and p_ip is not null and p_ip <> '' then
    select last_order_at into v_ip_last
    from public.order_rate_limits
    where key_type = 'ip' and key_value = p_ip
    for update;

    if v_ip_last is not null then
      v_ip_wait := greatest(0, ceil(extract(epoch from ((v_ip_last + make_interval(mins => p_ip_minutes)) - v_now)) / 60.0)::integer);
    end if;
  end if;

  v_wait := greatest(v_phone_wait, v_ip_wait);

  if v_wait > 0 then
    return jsonb_build_object('allowed', false, 'wait_minutes', v_wait, 'phone_wait', v_phone_wait, 'ip_wait', v_ip_wait);
  end if;

  if p_phone_minutes > 0 then
    insert into public.order_rate_limits(key_type, key_value, last_order_at)
    values ('phone', p_phone, v_now)
    on conflict (key_type, key_value) do update set last_order_at = excluded.last_order_at;
  end if;

  if p_ip_minutes > 0 and p_ip is not null and p_ip <> '' then
    insert into public.order_rate_limits(key_type, key_value, last_order_at)
    values ('ip', p_ip, v_now)
    on conflict (key_type, key_value) do update set last_order_at = excluded.last_order_at;
  end if;

  return jsonb_build_object('allowed', true, 'wait_minutes', 0, 'phone_wait', 0, 'ip_wait', 0);
end;
$$;

grant execute on function public.check_and_touch_order_rate_limit(text, text, integer, integer) to service_role;
