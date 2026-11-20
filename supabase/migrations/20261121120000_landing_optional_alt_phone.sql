ALTER TABLE public.landing_checkout_intents ADD COLUMN IF NOT EXISTS alternative_phone text;

CREATE OR REPLACE FUNCTION public.create_landing_checkout_intent(
  p_checkout_session_id uuid, p_customer_name text, p_customer_phone text, p_customer_address text,
  p_delivery_fee numeric, p_seed_items jsonb, p_nutrimix_item jsonb, p_notes text,
  p_client_ip text, p_device_id text, p_alternative_phone text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
  v_alternative_phone text := nullif(trim(coalesce(p_alternative_phone,'')), '');
BEGIN
  IF coalesce(trim(p_customer_name),'')='' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF p_customer_phone !~ '^01[3-9][0-9]{8}$' THEN RAISE EXCEPTION 'Invalid Bangladesh mobile number'; END IF;
  IF v_alternative_phone IS NOT NULL AND v_alternative_phone !~ '^01[3-9][0-9]{8}$' THEN RAISE EXCEPTION 'Invalid Bangladesh alternative mobile number'; END IF;
  IF coalesce(trim(p_customer_address),'')='' THEN RAISE EXCEPTION 'Customer address is required'; END IF;
  IF jsonb_typeof(p_seed_items)<>'array' OR jsonb_array_length(p_seed_items)<1 THEN RAISE EXCEPTION 'At least one seed item is required'; END IF;
  IF coalesce(p_delivery_fee,0)<0 OR p_delivery_fee>10000 THEN RAISE EXCEPTION 'Invalid delivery fee'; END IF;
  IF public.is_blocked_visitor(p_client_ip,p_customer_phone) THEN RAISE EXCEPTION 'আপনাকে block করা হয়েছে'; END IF;

  INSERT INTO public.landing_checkout_intents(
    checkout_session_id,customer_name,customer_phone,customer_address,notes,
    delivery_fee,seed_items,nutrimix_item,client_ip,device_id,alternative_phone
  ) VALUES (
    p_checkout_session_id,trim(p_customer_name),p_customer_phone,trim(p_customer_address),
    p_notes,p_delivery_fee,p_seed_items,p_nutrimix_item,p_client_ip,v_device_id,v_alternative_phone
  )
  ON CONFLICT (checkout_session_id) DO UPDATE SET
    customer_name=excluded.customer_name, customer_phone=excluded.customer_phone,
    customer_address=excluded.customer_address, notes=excluded.notes,
    delivery_fee=excluded.delivery_fee, seed_items=excluded.seed_items,
    nutrimix_item=excluded.nutrimix_item, client_ip=excluded.client_ip,
    device_id=excluded.device_id, alternative_phone=excluded.alternative_phone
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_landing_checkout_intent(p_intent_id uuid, p_include_nutrimix boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_intent public.landing_checkout_intents%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
BEGIN
  SELECT * INTO v_intent FROM public.landing_checkout_intents WHERE id=p_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout intent not found'; END IF;
  IF v_intent.final_order_id IS NOT NULL THEN RETURN v_intent.final_order_id; END IF;
  IF public.is_blocked_visitor(v_intent.client_ip,v_intent.customer_phone) THEN RAISE EXCEPTION 'আপনাকে block করা হয়েছে'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_intent.seed_items) LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_item->>'id',''), 'name',coalesce(v_item->>'name',''),
      'price',greatest(0,coalesce((v_item->>'price')::numeric,0)),
      'quantity',greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)))
    ));
  END LOOP;

  IF p_include_nutrimix AND v_intent.nutrimix_item IS NOT NULL THEN
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_intent.nutrimix_item->>'id','landing-popup-nutrimix'),
      'name',coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX'),
      'price',greatest(0,coalesce((v_intent.nutrimix_item->>'price')::numeric,0)), 'quantity',1
    ));
  END IF;

  v_order_id := public.place_public_order(
    v_intent.customer_name, v_intent.customer_phone, v_intent.customer_address,
    v_intent.delivery_fee, v_items, v_intent.notes, v_intent.client_ip,
    v_intent.device_id, v_intent.alternative_phone
  );

  SELECT coalesce(sum((x->>'price')::numeric * greatest(1,least(1000,coalesce((x->>'quantity')::integer,1)))),0)
    INTO v_subtotal FROM jsonb_array_elements(v_items) x;
  UPDATE public.orders
    SET delivery_fee=greatest(0,floor(coalesce(v_intent.delivery_fee,0))),
        subtotal=v_subtotal,
        total=v_subtotal+greatest(0,floor(coalesce(v_intent.delivery_fee,0)))
  WHERE id=v_order_id;
  UPDATE public.landing_checkout_intents
    SET state='finalized',final_order_id=v_order_id,finalized_at=now()
  WHERE id=v_intent.id;
  RETURN v_order_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';