CREATE OR REPLACE FUNCTION public.finalize_home_checkout_intent(
  p_intent_id uuid,
  p_include_nutrimix boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_intent public.landing_checkout_intents%ROWTYPE;
  v_settings jsonb := '{}'::jsonb;
  v_minimum numeric := 0;
  v_enabled boolean := true;
  v_item jsonb;
  v_product_id uuid;
  v_db_price numeric;
  v_item_price numeric;
  v_subtotal numeric := 0;
BEGIN
  SELECT * INTO v_intent
  FROM public.landing_checkout_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout intent not found';
  END IF;

  IF v_intent.final_order_id IS NOT NULL THEN
    RETURN v_intent.final_order_id;
  END IF;

  -- The first settings row is canonical; duplicate rows currently contain
  -- conflicting minimum_home_order values, so never use an unordered LIMIT 1.
  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.site_settings
  ORDER BY id ASC
  LIMIT 1;

  v_enabled := COALESCE((v_settings->>'minimum_home_order_enabled')::boolean, true);
  v_minimum := GREATEST(0, FLOOR(COALESCE(NULLIF(v_settings->>'minimum_home_order','')::numeric, 200)));

  IF v_enabled AND v_minimum > 0 THEN
    IF jsonb_typeof(v_intent.seed_items) <> 'array' THEN
      RAISE EXCEPTION 'কার্টের পণ্য যাচাই করা যায়নি';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_intent.seed_items)
    LOOP
      IF NOT COALESCE((v_item->>'is_freebie')::boolean, false) THEN
        v_item_price := GREATEST(0, COALESCE(NULLIF(v_item->>'price','')::numeric, 0));
        v_db_price := NULL;
        v_product_id := NULL;

        BEGIN
          v_product_id := NULLIF(v_item->>'id','')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
          v_product_id := NULL;
        END;

        IF v_product_id IS NOT NULL THEN
          SELECT CASE WHEN sale_price IS NOT NULL AND sale_price > 0 THEN sale_price ELSE price END
          INTO v_db_price
          FROM public.products
          WHERE id = v_product_id AND is_active = true;
          v_item_price := COALESCE(v_db_price, v_item_price);
        END IF;

        v_subtotal := v_subtotal
          + v_item_price * GREATEST(1, LEAST(1000, COALESCE(NULLIF(v_item->>'quantity','')::integer, 1)));
      END IF;
    END LOOP;

    IF p_include_nutrimix AND v_intent.nutrimix_item IS NOT NULL THEN
      v_subtotal := v_subtotal
        + GREATEST(0, COALESCE(NULLIF(v_intent.nutrimix_item->>'price','')::numeric, 0));
    END IF;

    IF v_subtotal < v_minimum THEN
      RAISE EXCEPTION 'ন্যূনতম অর্ডার ৳%। আপনার পণ্যের মূল্য ৳% — আরও ৳% যোগ করুন।',
        v_minimum, FLOOR(v_subtotal), CEIL(v_minimum - v_subtotal);
    END IF;
  END IF;

  RETURN public.finalize_landing_checkout_intent(p_intent_id, p_include_nutrimix);
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_home_checkout_intent(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_home_checkout_intent(uuid, boolean) TO service_role;
