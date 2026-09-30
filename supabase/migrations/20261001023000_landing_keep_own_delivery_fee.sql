CREATE OR REPLACE FUNCTION public.finalize_landing_checkout_intent(p_intent_id uuid, p_include_nutrimix boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent public.landing_checkout_intents%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_nutrimix_price numeric;
  v_nutrimix_name text;
  v_nutrimix_id uuid;
  v_existing_nutrimix boolean := false;
  v_subtotal numeric;
begin
  select * into v_intent
  from public.landing_checkout_intents
  where id=p_intent_id
  for update;

  if not found then raise exception 'Checkout intent not found'; end if;

  if public.is_blocked_visitor(v_intent.client_ip,v_intent.customer_phone) then
    raise exception 'আপনাকে block করা হয়েছে';
  end if;

  -- The Place Order action creates the seed-only web order first.
  -- A later popup choice may safely upgrade that same order with NUTRIMIX.
  if v_intent.final_order_id is not null then
    v_order_id := v_intent.final_order_id;

    if p_include_nutrimix and v_intent.nutrimix_item is not null then
      v_nutrimix_name := coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX');
      v_nutrimix_price := greatest(0,coalesce((v_intent.nutrimix_item->>'price')::numeric,0));

      begin
        v_nutrimix_id := nullif(v_intent.nutrimix_item->>'id','')::uuid;
      exception when invalid_text_representation then
        v_nutrimix_id := null;
      end;

      if v_nutrimix_price <= 0 then
        raise exception 'Invalid NUTRIMIX price';
      end if;

      select exists(
        select 1
        from public.order_items oi
        where oi.order_id=v_order_id
          and oi.product_name=v_nutrimix_name
          and oi.price=v_nutrimix_price
      ) into v_existing_nutrimix;

      if not v_existing_nutrimix then
        insert into public.order_items(order_id,product_id,product_name,quantity,price,subtotal)
        values(v_order_id,v_nutrimix_id,v_nutrimix_name,1,v_nutrimix_price,v_nutrimix_price);

        select coalesce(sum(subtotal),0) into v_subtotal
        from public.order_items
        where order_id=v_order_id;

        update public.orders
        set subtotal=v_subtotal,
            total=v_subtotal+delivery_fee
        where id=v_order_id;
      end if;
    end if;

    update public.landing_checkout_intents
    set state='finalized',
        finalized_at=coalesce(finalized_at,now())
    where id=v_intent.id;

    return v_order_id;
  end if;

  for v_item in select value from jsonb_array_elements(v_intent.seed_items) loop
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_item->>'id',''),
      'name',coalesce(v_item->>'name',''),
      'price',greatest(0,coalesce((v_item->>'price')::numeric,0)),
      'quantity',greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)))
    ));
  end loop;

  if p_include_nutrimix and v_intent.nutrimix_item is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_intent.nutrimix_item->>'id','landing-popup-nutrimix'),
      'name',coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX'),
      'price',greatest(0,coalesce((v_intent.nutrimix_item->>'price')::numeric,0)),
      'quantity',1
    ));
  end if;

  v_order_id := public.place_public_order(
    v_intent.customer_name,
    v_intent.customer_phone,
    v_intent.customer_address,
    v_intent.delivery_fee,
    v_items,
    v_intent.notes,
    v_intent.client_ip
  );

  -- Landing pages control their own delivery charge: keep the landing value.
  update public.orders
    set delivery_fee=greatest(0,coalesce(v_intent.delivery_fee,0)),
        total=subtotal+greatest(0,coalesce(v_intent.delivery_fee,0))
  where id=v_order_id;

  update public.landing_checkout_intents
    set state='finalized',final_order_id=v_order_id,finalized_at=now()
  where id=v_intent.id;

  return v_order_id;
end $function$

