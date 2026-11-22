-- Repair attribution at the database finalization boundary.
-- The browser already persists source_url on landing_checkout_intents, but the
-- previous finalizer copied the default 'unknown' value without inspecting it.

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
     or v_url ~ '(^|//)(www\.)?(facebook\.com|fb\.com|fb\.me|instagram\.com)(/|[?#]|$)'
  then return 'facebook_ads'; end if;
  if v_url ~ '(^|[?&])ttclid='
     or v_url ~ '(^|[?&])utm_source=(tiktok|tiktok_ads|tt)([&#]|$)'
     or v_url ~ '(^|//)(www\.)?tiktok\.com(/|[?#]|$)'
  then return 'tiktok_ads'; end if;
  if v_url ~ '(^|[?&])utm_source=(google|bing|yahoo|duckduckgo)([&#]|$)'
     or v_url ~ '(^|//)(www\.)?(google|bing|yahoo|duckduckgo)\.'
  then return 'organic'; end if;
  return 'unknown';
end;
$$;

alter table public.orders drop constraint if exists orders_marketing_source_check;
alter table public.orders add constraint orders_marketing_source_check
  check (marketing_source in ('facebook_ads','tiktok_ads','organic','direct','unknown','manual_order'));

alter table public.landing_checkout_intents drop constraint if exists landing_checkout_intents_marketing_source_check;
alter table public.landing_checkout_intents add constraint landing_checkout_intents_marketing_source_check
  check (marketing_source in ('facebook_ads','tiktok_ads','organic','direct','unknown','manual_order'));

create or replace function public.finalize_landing_checkout_intent(
  p_intent_id uuid,
  p_include_nutrimix boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_intent public.landing_checkout_intents%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_marketing_source text;
begin
  select * into v_intent
  from public.landing_checkout_intents
  where id = p_intent_id
  for update;

  if not found then raise exception 'Checkout intent not found'; end if;
  if v_intent.final_order_id is not null then return v_intent.final_order_id; end if;
  if public.is_blocked_visitor(v_intent.client_ip, v_intent.customer_phone) then
    raise exception 'আপনাকে block করা হয়েছে';
  end if;

  v_marketing_source := case
    when v_intent.marketing_source in ('facebook_ads','tiktok_ads','organic','direct','manual_order')
      then v_intent.marketing_source
    else public.classify_marketing_source(v_intent.source_url)
  end;

  for v_item in select value from jsonb_array_elements(v_intent.seed_items) loop
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_item->>'id',''),
      'name', coalesce(v_item->>'name',''),
      'price', greatest(0, coalesce((v_item->>'price')::numeric,0)),
      'quantity', greatest(1, least(1000, coalesce((v_item->>'quantity')::integer,1))),
      'is_freebie', coalesce((v_item->>'is_freebie')::boolean,false)
    ));
  end loop;

  if p_include_nutrimix and v_intent.nutrimix_item is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_intent.nutrimix_item->>'id','landing-popup-nutrimix'),
      'name', coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX'),
      'price', greatest(0, coalesce((v_intent.nutrimix_item->>'price')::numeric,0)),
      'quantity', 1
    ));
  end if;

  v_order_id := public.place_public_order(
    v_intent.customer_name, v_intent.customer_phone, v_intent.customer_address,
    v_intent.delivery_fee, v_items, v_intent.notes, v_intent.client_ip,
    v_intent.device_id, v_intent.alternative_phone
  );

  select coalesce(sum((x->>'price')::numeric * greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))),0)
    into v_subtotal
  from jsonb_array_elements(v_items) x;

  update public.orders
  set delivery_fee = greatest(0, floor(coalesce(v_intent.delivery_fee,0))),
      subtotal = v_subtotal,
      total = v_subtotal + greatest(0, floor(coalesce(v_intent.delivery_fee,0))),
      marketing_source = v_marketing_source
  where id = v_order_id;

  update public.landing_checkout_intents
  set state='finalized', final_order_id=v_order_id, finalized_at=now(),
      marketing_source = v_marketing_source
  where id=v_intent.id;

  return v_order_id;
end;
$function$;

-- Backfill only when the stored landing URL proves the platform.
update public.orders o
set marketing_source = public.classify_marketing_source(i.source_url)
from public.landing_checkout_intents i
where i.final_order_id = o.id
  and o.marketing_source = 'unknown'
  and public.classify_marketing_source(i.source_url) in ('facebook_ads','tiktok_ads','organic');

-- Admin-created manual orders are already distinguishable by orders.source.
update public.orders
set marketing_source = 'manual_order'
where marketing_source = 'unknown' and source = 'manual';
