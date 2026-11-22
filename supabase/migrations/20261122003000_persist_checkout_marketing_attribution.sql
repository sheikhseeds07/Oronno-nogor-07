-- Expand referrer matching to Meta's redirect subdomains (l.facebook.com, lm.facebook.com)
-- and TikTok redirect subdomains (vm.tiktok.com, vt.tiktok.com).
create or replace function public.classify_marketing_source(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_url text := lower(coalesce(p_url, ''));
begin
  if v_url = '' then return 'unknown'; end if;
  if v_url ~ '(^|[?&])fbclid='
     or v_url ~ '(^|[?&])utm_source=(fb|ig|facebook|facebook_ads|meta|meta_ads|instagram|instagram_ads)([&#]|$)'
     or v_url ~ '(^|//)([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|instagram\.com)(/|[?#]|$)'
  then return 'facebook_ads'; end if;
  if v_url ~ '(^|[?&])ttclid='
     or v_url ~ '(^|[?&])utm_source=(tiktok|tiktok_ads|tt)([&#]|$)'
     or v_url ~ '(^|//)([a-z0-9-]+\.)*tiktok\.com(/|[?#]|$)'
  then return 'tiktok_ads'; end if;
  if v_url ~ '(^|[?&])utm_source=(google|bing|yahoo|duckduckgo)([&#]|$)'
     or v_url ~ '(^|//)([a-z0-9-]+\.)*(google|bing|yahoo|duckduckgo)\.'
  then return 'organic'; end if;
  return 'unknown';
end;
$$;

-- Persist acquisition data through checkout snapshots and delayed incomplete-order promotion.
alter table public.incomplete_orders
  add column if not exists marketing_source text not null default 'unknown',
  add column if not exists source_url text;

alter table public.incomplete_orders
  drop constraint if exists incomplete_orders_marketing_source_check;
alter table public.incomplete_orders
  add constraint incomplete_orders_marketing_source_check
  check (marketing_source in ('facebook_ads','tiktok_ads','organic','direct','unknown','manual_order'));

create or replace function public.promote_stale_incomplete_orders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  new_id uuid;
  promoted int := 0;
  subtotal_calc numeric;
  fee numeric;
  total_calc numeric;
  v_marketing_source text;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'incomplete_orders' and c.relkind = 'r'
  ) then return 0; end if;

  for r in
    select * from public.incomplete_orders
    where created_at <= now() - interval '20 minutes'
    order by created_at asc
    limit 200
    for update skip locked
  loop
    if public.phone_repeat_wait_minutes(r.phone) > 0 then
      delete from public.incomplete_orders where id = r.id;
      continue;
    end if;

    if exists (
      select 1 from public.orders o
      where regexp_replace(o.customer_phone, '[^0-9]', '', 'g') = regexp_replace(r.phone, '[^0-9]', '', 'g')
        and o.created_at >= r.created_at
    ) then
      delete from public.incomplete_orders where id = r.id;
      continue;
    end if;

    if r.items is null or jsonb_typeof(r.items) <> 'array' or jsonb_array_length(r.items) = 0 then
      continue;
    end if;

    select coalesce(sum(
      (coalesce(i->>'price', '0'))::numeric * greatest(1, (coalesce(i->>'quantity', '1'))::numeric)
    ), 0) into subtotal_calc
    from jsonb_array_elements(r.items) as i;

    fee := coalesce(r.delivery_fee, 0);
    total_calc := coalesce(nullif(r.total, 0), subtotal_calc + fee);
    v_marketing_source := case
      when r.marketing_source in ('facebook_ads','tiktok_ads','organic','direct','manual_order') then r.marketing_source
      else public.classify_marketing_source(r.source_url)
    end;

    insert into public.orders (
      customer_name, customer_phone, customer_address, thana, district, notes,
      subtotal, delivery_fee, discount, total, source, status, payment_method,
      originated_from_incomplete, marketing_source
    ) values (
      coalesce(nullif(btrim(coalesce(r.customer_name, '')), ''), r.phone),
      r.phone, r.customer_address, null, r.delivery_zone, r.note,
      subtotal_calc, fee, 0, total_calc, 'incomplete', 'web_pending', 'cod',
      true, coalesce(v_marketing_source, 'unknown')
    ) returning id into new_id;

    insert into public.order_items (order_id, product_id, product_name, quantity, price, subtotal)
    select new_id, null, coalesce(nullif(btrim(coalesce(i->>'name', '')), ''), 'Item'),
      greatest(1, (coalesce(i->>'quantity', '1'))::int),
      (coalesce(i->>'price', '0'))::numeric,
      (coalesce(i->>'price', '0'))::numeric * greatest(1, (coalesce(i->>'quantity', '1'))::int)
    from jsonb_array_elements(r.items) as i;

    if to_regclass('public.incomplete_events') is not null then
      begin
        insert into public.incomplete_events (phone, event) values (r.phone, 'converted');
      exception when others then null;
      end;
    end if;

    delete from public.incomplete_orders where id = r.id;
    promoted := promoted + 1;
  end loop;
  return promoted;
end;
$function$;

-- Existing admin-created manual orders have a deterministic source.
update public.orders set marketing_source='manual_order'
where source::text='manual' and marketing_source='unknown';
