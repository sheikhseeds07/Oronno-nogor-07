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
  v_now timestamptz := clock_timestamp();
  v_phone_last timestamptz;
  v_ip_last timestamptz;
  v_wait integer := 0;
  v_phone_wait integer := 0;
  v_ip_wait integer := 0;
  v_phone_expiry timestamptz;
  v_ip_expiry timestamptz;
begin
  -- Read the last successful reservation for each enabled key.
  if p_phone_minutes > 0 and nullif(trim(p_phone), '') is not null then
    select last_order_at into v_phone_last
    from public.order_rate_limits
    where key_type = 'phone' and key_value = trim(p_phone)
    for update;
    if v_phone_last is not null then
      v_phone_expiry := v_phone_last + make_interval(mins => p_phone_minutes);
      if v_now < v_phone_expiry then
        v_phone_wait := greatest(1, ceil(extract(epoch from (v_phone_expiry - v_now)) / 60.0)::integer);
      end if;
    end if;
  end if;

  if p_ip_minutes > 0 and nullif(trim(p_ip), '') is not null then
    select last_order_at into v_ip_last
    from public.order_rate_limits
    where key_type = 'ip' and key_value = trim(p_ip)
    for update;
    if v_ip_last is not null then
      v_ip_expiry := v_ip_last + make_interval(mins => p_ip_minutes);
      if v_now < v_ip_expiry then
        v_ip_wait := greatest(1, ceil(extract(epoch from (v_ip_expiry - v_now)) / 60.0)::integer);
      end if;
    end if;
  end if;

  v_wait := greatest(v_phone_wait, v_ip_wait);

  -- Only block while at least one configured cooldown is genuinely active.
  -- Once the exact cooldown timestamp is reached, the next order is allowed.
  if v_wait > 0 then
    return jsonb_build_object('allowed', false, 'wait_minutes', v_wait, 'phone_wait', v_phone_wait, 'ip_wait', v_ip_wait);
  end if;

  if p_phone_minutes > 0 and nullif(trim(p_phone), '') is not null then
    insert into public.order_rate_limits(key_type, key_value, last_order_at)
    values ('phone', trim(p_phone), v_now)
    on conflict (key_type, key_value) do update set last_order_at = excluded.last_order_at;
  end if;

  if p_ip_minutes > 0 and nullif(trim(p_ip), '') is not null then
    insert into public.order_rate_limits(key_type, key_value, last_order_at)
    values ('ip', trim(p_ip), v_now)
    on conflict (key_type, key_value) do update set last_order_at = excluded.last_order_at;
  end if;

  return jsonb_build_object('allowed', true, 'wait_minutes', 0, 'phone_wait', 0, 'ip_wait', 0);
end;
$$;

grant execute on function public.check_and_touch_order_rate_limit(text, text, integer, integer) to service_role;
