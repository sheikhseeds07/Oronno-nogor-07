-- Send a server Purchase for orders auto-promoted from incomplete checkouts.
-- These orders never hit the browser/server Purchase path, so Meta missed them.
create or replace function public.queue_order_purchase_capi(o public.orders)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_digits text;
  v_ph text;
  v_fn text;
  v_user jsonb;
  v_body jsonb;
begin
    if o.status::text in ('cancelled', 'deleted') then return false; end if;

  v_digits := regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g');
  if v_digits <> '' then
    v_ph := case when v_digits like '880%' then v_digits else regexp_replace(v_digits, '^0', '880') end;
  end if;
  v_fn := nullif(lower(trim(split_part(coalesce(o.customer_name, ''), ' ', 1))), '');

  v_user := jsonb_build_object(
    'external_id', jsonb_build_array(encode(sha256(convert_to(lower(o.id::text), 'UTF8')), 'hex')),
    'country', jsonb_build_array(encode(sha256(convert_to('bd', 'UTF8')), 'hex'))
  );
  if v_ph is not null then
    v_user := v_user || jsonb_build_object('ph', jsonb_build_array(encode(sha256(convert_to(v_ph, 'UTF8')), 'hex')));
  end if;
  if v_fn is not null then
    v_user := v_user || jsonb_build_object('fn', jsonb_build_array(encode(sha256(convert_to(v_fn, 'UTF8')), 'hex')));
  end if;
  if nullif(trim(coalesce(o.client_ip::text, '')), '') is not null then
    v_user := v_user || jsonb_build_object('client_ip_address', o.client_ip::text);
  end if;

  v_body := jsonb_build_object('data', jsonb_build_array(jsonb_build_object(
    'event_name', 'Purchase',
    'event_time', extract(epoch from least(now(), greatest(coalesce(o.created_at, now()), now() - interval '6 days')))::bigint,
    'event_id', o.id::text,
    'action_source', 'website',
    'user_data', v_user,
    'custom_data', jsonb_build_object('currency', 'BDT', 'value', coalesce(o.total, 0), 'order_id', o.id::text)
  )));

  return public.queue_meta_capi_purchase(o.id::text, v_body);
exception when others then
  raise warning 'incomplete purchase queue failed: %', sqlerrm;
  return false;
end;
$$;

revoke all on function public.queue_order_purchase_capi(public.orders) from public, anon, authenticated;

create or replace function public.queue_incomplete_order_purchase()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if coalesce(new.source, '') = 'incomplete' then
    perform public.queue_order_purchase_capi(new);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public.queue_incomplete_order_purchase() from public, anon, authenticated;

drop trigger if exists trg_queue_incomplete_order_purchase on public.orders;
create trigger trg_queue_incomplete_order_purchase
after insert on public.orders
for each row execute function public.queue_incomplete_order_purchase();

-- One-time catch-up for recent promoted orders that Meta never received.
select public.queue_order_purchase_capi(o) from public.orders o
where o.source = 'incomplete' and o.status::text not in ('cancelled','deleted')
  and o.created_at > now() - interval '3 days';
