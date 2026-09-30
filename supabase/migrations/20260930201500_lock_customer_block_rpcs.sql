CREATE OR REPLACE FUNCTION public.block_customer(p_phone text, p_ip text, p_name text DEFAULT NULL::text)
 RETURNS SETOF customer_blocks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_phone text := public.normalize_bd_phone(p_phone);
  v_ip text := replace(nullif(trim(coalesce(p_ip,'')), ''), '::ffff:', '');
  v_row public.customer_blocks;
  v_by text := coalesce(auth.email(), 'Admin');
begin
  if not public.can_manage_customer_blocks() then raise exception 'Unauthorized'; end if;
  if v_phone is null and v_ip is null then
    raise exception 'phone or ip required';
  end if;

  -- Existing row for this phone (preferred), else for this IP.
  if v_phone is not null then
    select * into v_row from public.customer_blocks where phone = v_phone limit 1;
  end if;
  if v_row.id is null and v_ip is not null then
    select * into v_row from public.customer_blocks where ip_address = v_ip limit 1;
  end if;

  -- Merge: drop any other row that already holds one of these values.
  if v_row.id is not null then
    delete from public.customer_blocks
     where id <> v_row.id
       and ((v_phone is not null and phone = v_phone) or (v_ip is not null and ip_address = v_ip));

    update public.customer_blocks
       set is_active = true,
           unblocked_at = null,
           blocked_at = now(),
           phone = coalesce(v_phone, phone),
           ip_address = coalesce(v_ip, ip_address),
           customer_name = coalesce(p_name, customer_name),
           blocked_by = v_by
     where id = v_row.id
     returning * into v_row;
  else
    insert into public.customer_blocks (customer_name, phone, ip_address, is_active, blocked_by)
    values (p_name, v_phone, v_ip, true, v_by)
    returning * into v_row;
  end if;

  return next v_row;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.unblock_customer(p_id uuid, p_unblock_phone boolean DEFAULT true, p_unblock_ip boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.customer_blocks;
  v_phone text;
  v_ip text;
begin
  if not public.can_manage_customer_blocks() then raise exception 'Unauthorized'; end if;
  select * into v_row from public.customer_blocks where id = p_id;
  if v_row.id is null then return; end if;

  v_phone := case when p_unblock_phone then null else v_row.phone end;
  v_ip := case when p_unblock_ip then null else v_row.ip_address end;

  if v_phone is null and v_ip is null then
    delete from public.customer_blocks where id = p_id;
  else
    update public.customer_blocks
       set phone = v_phone, ip_address = v_ip, blocked_by = coalesce(auth.email(), blocked_by, 'Admin')
     where id = p_id;
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.list_customer_blocks()
 RETURNS TABLE(id uuid, customer_name text, phone text, ip_address text, is_active boolean, blocked_at timestamp with time zone, unblocked_at timestamp with time zone, blocked_by text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$ select id, customer_name, phone, ip_address, is_active, blocked_at, unblocked_at, blocked_by from public.customer_blocks where is_active and public.can_manage_customer_blocks() order by blocked_at desc $f$;