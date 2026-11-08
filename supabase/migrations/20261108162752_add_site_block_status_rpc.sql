create or replace function public.get_site_block_status(
  p_ip text default null,
  p_device_id text default null,
  p_customer_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(trim(coalesce(p_device_id, '')), '');
begin
  if p_ip is not null and public.is_blocked_visitor(p_ip, null) then
    return true;
  end if;

  if p_customer_id is not null and v_user_id = p_customer_id then
    if v_device_id is not null and char_length(v_device_id) between 6 and 80 then
      insert into public.customer_devices (customer_id, device_id, last_seen_at)
      values (p_customer_id, v_device_id, now())
      on conflict (customer_id, device_id)
      do update set last_seen_at = excluded.last_seen_at;
    end if;

    if exists (
      select 1
      from public.customer_profiles cp
      where cp.id = p_customer_id
        and cp.is_blocked is true
    ) then
      return true;
    end if;
  elsif p_customer_id is not null
    and v_device_id is not null
    and exists (
      select 1
      from public.customer_devices cd
      where cd.customer_id = p_customer_id
        and cd.device_id = v_device_id
    )
    and exists (
      select 1
      from public.customer_profiles cp
      where cp.id = p_customer_id
        and cp.is_blocked is true
    ) then
    return true;
  end if;

  if v_device_id is not null and char_length(v_device_id) between 6 and 80
    and exists (
      select 1
      from public.customer_devices cd
      join public.customer_profiles cp on cp.id = cd.customer_id
      where cd.device_id = v_device_id
        and cp.is_blocked is true
    ) then
    return true;
  end if;

  return false;
end;
$function$;

revoke all on function public.get_site_block_status(text, text, uuid) from public;
grant execute on function public.get_site_block_status(text, text, uuid) to anon, authenticated, service_role;
