-- Same-device + same-phone repeat-order protection.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.landing_checkout_intents ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS orders_repeat_phone_device_created_idx ON public.orders (public.normalize_bd_phone(customer_phone), device_id, created_at DESC) WHERE source='web' AND device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_and_touch_order_rate_limit_device(p_phone text,p_device_id text,p_phone_minutes integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_now timestamptz:=clock_timestamp(); v_phone text:=nullif(trim(coalesce(p_phone,'')),''); v_device_id text:=nullif(trim(coalesce(p_device_id,'')),''); v_last timestamptz; v_wait integer:=0;
BEGIN
 IF p_phone_minutes<=0 OR v_phone IS NULL OR v_device_id IS NULL THEN RETURN jsonb_build_object('allowed',true,'wait_minutes',0); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('order-repeat-device:'||public.normalize_bd_phone(v_phone)||'|'||v_device_id,0));
 SELECT max(o.created_at) INTO v_last FROM public.orders o WHERE o.source='web' AND o.device_id=v_device_id AND public.normalize_bd_phone(o.customer_phone)=public.normalize_bd_phone(v_phone);
 IF v_last IS NOT NULL AND v_last+make_interval(mins=>least(10080,greatest(0,p_phone_minutes)))>v_now THEN
  v_wait:=greatest(1,ceil(extract(epoch from ((v_last+make_interval(mins=>least(10080,greatest(0,p_phone_minutes))))-v_now))/60.0)::integer);
 END IF;
 IF v_wait>0 THEN RETURN jsonb_build_object('allowed',false,'wait_minutes',v_wait); END IF;
 RETURN jsonb_build_object('allowed',true,'wait_minutes',0);
END; $function$;

CREATE OR REPLACE FUNCTION public.place_public_order(p_customer_name text, p_customer_phone text, p_customer_address text, p_delivery_fee numeric, p_items jsonb, p_notes text DEFAULT NULL::text, p_client_ip text DEFAULT NULL::text,
 p_device_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order_id uuid;
  v_settings jsonb := '{}'::jsonb;
  v_phone_minutes integer := 0;
  v_rate jsonb;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_product_name text;
  v_quantity integer;
  v_input_price numeric;
  v_db_price numeric;
  v_rules jsonb;
  v_rule jsonb;
  v_min_order numeric;
  v_fee numeric;
  v_has_zero boolean := false;
  v_server_delivery_fee numeric := 0;
  v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
BEGIN
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) < 1 OR length(p_customer_name) > 255 THEN
    RAISE EXCEPTION 'নাম সঠিক নয়';
  END IF;
  IF p_customer_phone IS NULL OR p_customer_phone !~ '^01[3-9][0-9]{8}$' THEN
    RAISE EXCEPTION 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন';
  END IF;
  IF p_customer_address IS NULL OR length(trim(p_customer_address)) < 1 OR length(p_customer_address) > 1000 THEN
    RAISE EXCEPTION 'ঠিকানা সঠিক নয়';
  END IF;
  IF p_delivery_fee IS NULL OR p_delivery_fee < 0 OR p_delivery_fee > 10000 THEN
    RAISE EXCEPTION 'ডেলিভারি চার্জ সঠিক নয়';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'অর্ডারের পণ্য সঠিক নয়';
  END IF;

  -- Double-click / retry guard: same phone within 60s returns the existing order.
  PERFORM pg_advisory_xact_lock(hashtext('place_public_order:' || p_customer_phone));
  DECLARE v_recent uuid; BEGIN
    -- Only a true double-submit (same phone AND the exact same items) reuses the
    -- recent order. A different product within 60s must create its own order.
    SELECT o.id INTO v_recent FROM public.orders o
     WHERE o.customer_phone = p_customer_phone AND o.source = 'web' AND o.created_at > now() - interval '60 seconds'
       AND (SELECT coalesce(string_agg(oi.product_name || '#' || oi.quantity::text, '|' ORDER BY oi.product_name, oi.quantity), '')
              FROM public.order_items oi WHERE oi.order_id = o.id)
         = (SELECT coalesce(string_agg(left(coalesce(x->>'name',''),500) || '#' || greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))::text, '|' ORDER BY left(coalesce(x->>'name',''),500), greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))), '')
              FROM jsonb_array_elements(p_items) x)
     ORDER BY o.created_at DESC LIMIT 1;
    IF v_recent IS NOT NULL THEN RETURN v_recent; END IF;
  END;

  SELECT coalesce(settings, '{}'::jsonb) INTO v_settings FROM public.site_settings LIMIT 1;
  v_phone_minutes := greatest(0, least(10080, coalesce(nullif(v_settings->>'order_repeat_phone_minutes','')::integer, nullif(v_settings->>'order_phone_repeat_minutes','')::integer, 0)));
  -- IP repeat blocking is intentionally disabled; IPs are shared by unrelated customers.
  IF v_phone_minutes > 0 AND v_device_id IS NOT NULL THEN
    v_rate := public.check_and_touch_order_rate_limit_device(p_customer_phone, v_device_id, v_phone_minutes);
    IF coalesce((v_rate->>'allowed')::boolean, true) = false THEN
      RAISE EXCEPTION 'আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে। পরবর্তী অর্ডার করতে আরও % মিনিট অপেক্ষা করুন।', greatest(1, coalesce((v_rate->>'wait_minutes')::integer, greatest(v_phone_minutes, v_ip_minutes)));
    END IF;
  END IF;

  INSERT INTO public.orders (
    customer_name, customer_phone, customer_address, district, thana, notes,
    subtotal, delivery_fee, total, payment_method, source, status, created_by,
    originated_from_incomplete, client_ip, device_id
  ) VALUES (
    trim(p_customer_name), p_customer_phone, trim(p_customer_address), NULL, NULL,
    nullif(trim(coalesce(p_notes,'')), ''), 0, p_delivery_fee, 0, 'COD', 'web',
    'web_pending', NULL, false, nullif(trim(coalesce(p_client_ip,'')), ''), v_device_id
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_name := left(coalesce(v_item->>'name',''), 500);
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_input_price := coalesce((v_item->>'price')::numeric, 0);
    IF length(trim(v_product_name)) < 1 OR v_quantity < 1 OR v_quantity > 1000 OR v_input_price < 0 OR v_input_price > 10000000 THEN
      RAISE EXCEPTION 'অর্ডারের পণ্য সঠিক নয়';
    END IF;

    BEGIN
      v_product_id := nullif(v_item->>'id','')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_product_id := NULL;
    END;

    v_db_price := NULL;
    IF v_product_id IS NOT NULL THEN
      SELECT CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END
      INTO v_db_price
      FROM public.products
      WHERE id = v_product_id AND is_active = true;
    END IF;

    v_input_price := coalesce(v_db_price, v_input_price);
    v_subtotal := v_subtotal + (v_input_price * v_quantity);

    INSERT INTO public.order_items(order_id, product_id, product_name, price, quantity, subtotal)
    VALUES (v_order_id, CASE WHEN v_db_price IS NULL THEN NULL ELSE v_product_id END, v_product_name, v_input_price, v_quantity, v_input_price * v_quantity);
  END LOOP;

  -- Recompute the delivery fee from the site's configured delivery_rules
  -- (same tiers the checkout page shows) instead of trusting the client value.
  v_rules := v_settings->'delivery_rules';
  IF v_rules IS NULL OR jsonb_typeof(v_rules) <> 'array' OR jsonb_array_length(v_rules) = 0 THEN
    v_rules := '[{"min_order":0,"fee":120},{"min_order":200,"fee":70},{"min_order":300,"fee":50},{"min_order":800,"fee":0}]'::jsonb;
  END IF;

  v_has_zero := false;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_rules)
  LOOP
    IF greatest(0, floor(coalesce((v_rule->>'min_order')::numeric, 0))) = 0 THEN
      v_has_zero := true;
    END IF;
  END LOOP;
  IF NOT v_has_zero THEN
    v_rules := '[{"min_order":0,"fee":120},{"min_order":200,"fee":70},{"min_order":300,"fee":50},{"min_order":800,"fee":0}]'::jsonb;
  END IF;

  v_server_delivery_fee := 120;
  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_rules) ORDER BY coalesce((value->>'min_order')::numeric, 0) ASC
  LOOP
    v_min_order := greatest(0, floor(coalesce((v_rule->>'min_order')::numeric, 0)));
    v_fee := greatest(0, floor(coalesce((v_rule->>'fee')::numeric, 0)));
    IF v_min_order <= v_subtotal THEN
      v_server_delivery_fee := v_fee;
    END IF;
  END LOOP;

  v_total := v_subtotal + v_server_delivery_fee;
  UPDATE public.orders SET subtotal = v_subtotal, delivery_fee = v_server_delivery_fee, total = v_total WHERE id = v_order_id;
  RETURN v_order_id;
EXCEPTION
  WHEN others THEN
    IF v_order_id IS NOT NULL THEN
      DELETE FROM public.order_items WHERE order_id = v_order_id;
      DELETE FROM public.orders WHERE id = v_order_id;
    END IF;
    RAISE;
END;
$function$;

create or replace function public.create_landing_checkout_intent(
  p_checkout_session_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_fee numeric,
  p_seed_items jsonb,
  p_nutrimix_item jsonb default null,
  p_notes text default null,
  p_client_ip text default null,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
declare v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
begin
  if coalesce(trim(p_customer_name),'')='' then raise exception 'Customer name is required'; end if;
  if p_customer_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Invalid Bangladesh mobile number'; end if;
  if coalesce(trim(p_customer_address),'')='' then raise exception 'Customer address is required'; end if;
  if jsonb_typeof(p_seed_items)<>'array' or jsonb_array_length(p_seed_items)<1 then raise exception 'At least one seed item is required'; end if;
  if coalesce(p_delivery_fee,0)<0 or p_delivery_fee>10000 then raise exception 'Invalid delivery fee'; end if;

  insert into public.landing_checkout_intents(
    checkout_session_id,customer_name,customer_phone,customer_address,notes,
    delivery_fee,seed_items,nutrimix_item,client_ip,device_id
  )
  values(
    p_checkout_session_id,trim(p_customer_name),p_customer_phone,trim(p_customer_address),
    p_notes,p_delivery_fee,p_seed_items,p_nutrimix_item,p_client_ip,v_device_id
  )
  on conflict (checkout_session_id) do update
    set customer_name=excluded.customer_name,
        customer_phone=excluded.customer_phone,
        customer_address=excluded.customer_address,
        notes=excluded.notes,
        delivery_fee=excluded.delivery_fee,
        seed_items=excluded.seed_items,
        nutrimix_item=excluded.nutrimix_item,
        client_ip=excluded.client_ip,
        device_id=excluded.device_id
  returning id into v_id;
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.finalize_landing_checkout_intent(
  p_intent_id uuid,
  p_include_nutrimix boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_intent public.landing_checkout_intents%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
BEGIN
  SELECT * INTO v_intent
  FROM public.landing_checkout_intents
  WHERE id=p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout intent not found'; END IF;
  IF v_intent.final_order_id IS NOT NULL THEN RETURN v_intent.final_order_id; END IF;

  IF public.is_blocked_visitor(v_intent.client_ip,v_intent.customer_phone) THEN
    RAISE EXCEPTION 'আপনাকে block করা হয়েছে';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_intent.seed_items) LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_item->>'id',''),
      'name',coalesce(v_item->>'name',''),
      'price',greatest(0,coalesce((v_item->>'price')::numeric,0)),
      'quantity',greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)))
    ));
  END LOOP;

  IF p_include_nutrimix AND v_intent.nutrimix_item IS NOT NULL THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_intent.nutrimix_item->>'id','landing-popup-nutrimix'),
      'name',coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX'),
      'price',greatest(0,coalesce((v_intent.nutrimix_item->>'price')::numeric,0)),
      'quantity',1
    ));
  END IF;

  v_order_id := public.place_public_order(
    v_intent.customer_name,
    v_intent.customer_phone,
    v_intent.customer_address,
    v_intent.delivery_fee,
    v_items,
    v_intent.notes,
    v_intent.client_ip,
    v_intent.device_id
  );

  SELECT coalesce(sum((x->>'price')::numeric * greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))),0)
    INTO v_subtotal
  FROM jsonb_array_elements(v_items) x;

  UPDATE public.orders
  SET delivery_fee = greatest(0, floor(coalesce(v_intent.delivery_fee,0))),
      subtotal = v_subtotal,
      total = v_subtotal + greatest(0, floor(coalesce(v_intent.delivery_fee,0)))
  WHERE id = v_order_id;

  UPDATE public.landing_checkout_intents
    SET state='finalized',final_order_id=v_order_id,finalized_at=now()
  WHERE id=v_intent.id;

  RETURN v_order_id;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalize_landing_checkout_intent(uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_landing_checkout_intent(uuid,boolean) TO service_role;
