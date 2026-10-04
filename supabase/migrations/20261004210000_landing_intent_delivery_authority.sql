-- Ensure the selected landing offer delivery fee is authoritative at finalization.
-- This prevents generic site delivery tiers from overwriting addon-specific free delivery.
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
    v_intent.client_ip
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
