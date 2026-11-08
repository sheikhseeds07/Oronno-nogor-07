create or replace function public.lookup_checkout_customer_by_phone(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_digits text; v_local text; v_intl text; v_result jsonb;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), E'[^0-9]', '', 'g');
  if length(v_digits) < 11 or length(v_digits) > 13 then return null; end if;
  if left(v_digits, 3) = '880' and length(v_digits) = 13 then v_local := '0' || substr(v_digits, 4);
  elsif left(v_digits, 2) = '88' and length(v_digits) = 13 then v_local := '0' || substr(v_digits, 3);
  else v_local := v_digits; end if;
  if length(v_local) <> 11 or v_local !~ '^01[3-9][0-9]{8}$' then return null; end if;
  v_intl := '88' || v_local;
  select jsonb_build_object('name', o.customer_name, 'address', o.customer_address) into v_result
  from public.orders o
  where regexp_replace(coalesce(o.customer_phone, ''), E'[^0-9]', '', 'g') in (v_local, v_intl)
  order by o.created_at desc limit 1;
  return v_result;
end; $function$;
revoke all on function public.lookup_checkout_customer_by_phone(text) from public;
grant execute on function public.lookup_checkout_customer_by_phone(text) to anon, authenticated, service_role;