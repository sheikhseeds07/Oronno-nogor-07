alter table public.landing_checkout_intents
  add column if not exists marketing_source text not null default 'unknown';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'landing_checkout_intents_marketing_source_check'
      and conrelid = 'public.landing_checkout_intents'::regclass
  ) then
    alter table public.landing_checkout_intents
      add constraint landing_checkout_intents_marketing_source_check
      check (marketing_source in ('facebook_ads','tiktok_ads','organic','direct','unknown')) not valid;
  end if;
end $$;
alter table public.landing_checkout_intents validate constraint landing_checkout_intents_marketing_source_check;

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
    v_intent.customer_name,
    v_intent.customer_phone,
    v_intent.customer_address,
    v_intent.delivery_fee,
    v_items,
    v_intent.notes,
    v_intent.client_ip,
    v_intent.device_id,
    v_intent.alternative_phone
  );

  select coalesce(sum((x->>'price')::numeric * greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))),0)
    into v_subtotal
  from jsonb_array_elements(v_items) x;

  update public.orders
  set delivery_fee = greatest(0, floor(coalesce(v_intent.delivery_fee,0))),
      subtotal = v_subtotal,
      total = v_subtotal + greatest(0, floor(coalesce(v_intent.delivery_fee,0))),
      marketing_source = coalesce(v_intent.marketing_source, 'unknown')
  where id = v_order_id;

  update public.landing_checkout_intents
    set state='finalized', final_order_id=v_order_id, finalized_at=now()
  where id=v_intent.id;

  return v_order_id;
end;
$function$;

comment on column public.landing_checkout_intents.marketing_source is
  'Captured marketing attribution carried into the final order, including automatic intent finalization.';
