-- Fix customer blocking: the admin UI uses customer_blocks while the
-- public site/checkout historically enforced customer_blocklist. Keep both
-- stores synchronized so a block actually applies site-wide.

create or replace function public.block_customer(p_phone text, p_ip text, p_name text default null)
returns setof public.customer_blocks
language plpgsql
security definer
set search_path=public
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

  if coalesce(trim(p_name), '') <> '' then
    update public.customer_blocklist
       set is_active = true,
           blocked_by = auth.uid(),
           blocked_at = now(),
           unblocked_by = null,
           unblocked_at = null
     where lower(customer_name) = lower(trim(p_name))
       and ip_address is not distinct from nullif(trim(p_ip), '');

    if not found then
      insert into public.customer_blocklist(customer_name, ip_address, blocked_by)
      values (trim(p_name), nullif(trim(p_ip), ''), auth.uid());
    end if;
  end if;

  return next v_row;
end
$$;

grant execute on function public.block_customer(text,text,text) to authenticated, service_role;

create or replace function public.unblock_customer(p_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_row public.customer_blocks;
begin
  select * into v_row from public.customer_blocks where id = p_id;
  if v_row.id is null then return; end if;

  update public.customer_blocks
     set is_active = false, unblocked_at = now()
   where id = p_id;

  update public.customer_blocklist
     set is_active = false,
         unblocked_by = auth.uid(),
         unblocked_at = now()
   where lower(customer_name) = lower(coalesce(v_row.customer_name, ''))
     and ip_address is not distinct from v_row.ip_address;
end
$$;

grant execute on function public.unblock_customer(uuid) to authenticated, service_role;

create or replace function public.is_blocked_visitor(p_ip text default null, p_phone text default null)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.customer_blocks b
    where b.is_active
      and ((p_ip is not null and b.ip_address = p_ip)
        or (p_phone is not null and b.phone = public.normalize_bd_phone(p_phone)))
  )
  or exists (
    select 1 from public.customer_blocklist b
    where b.is_active and p_ip is not null and b.ip_address = p_ip
  )
$$;

grant execute on function public.is_blocked_visitor(text,text) to anon, authenticated, service_role;
