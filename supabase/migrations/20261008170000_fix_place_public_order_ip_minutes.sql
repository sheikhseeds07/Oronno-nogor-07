-- Fix: blocked repeat-order message referenced a removed variable (v_ip_minutes).
CREATE OR REPLACE FUNCTION public.place_public_order(p_customer_name text, p_customer_phone text, p_customer_address text, p_delivery_fee numeric, p_items jsonb, p_notes text DEFAULT NULL::text, p_client_ip text DEFAULT NULL::text, p_device_id text DEFAULT NULL::text)
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
      RAISE EXCEPTION 'আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে। পরবর্তী অর্ডার করতে আরও % মিনিট অপেক্ষা করুন।', greatest(1, coalesce((v_rate->>'wait_minutes')::integer, v_phone_minutes));
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

  -- Landing-page offers own their delivery charge (e.g. free delivery).
  -- If every ordered item belongs to one published landing page (its main
  -- product or one of its edit-panel offers), use that page's configured fee.
  SELECT min(page_fee) INTO v_fee FROM (
    SELECT lp.id, max(
             CASE WHEN a.value IS NOT NULL
                  THEN greatest(0, coalesce(nullif(a.value->>'delivery_fee','')::numeric, lp.main_delivery_fee, lp.delivery_inside, v_server_delivery_fee))
                  ELSE greatest(0, coalesce(lp.main_delivery_fee, lp.delivery_inside, v_server_delivery_fee)) END
           ) AS page_fee,
           count(*) AS matched
      FROM public.landing_pages lp
      CROSS JOIN LATERAL jsonb_array_elements(p_items) it
      LEFT JOIN LATERAL (
        SELECT x.value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lp.addons)='array' THEN lp.addons ELSE '[]'::jsonb END) x
         WHERE trim(x.value->>'name') = trim(it.value->>'name') LIMIT 1
      ) a ON true
     WHERE lp.is_published = true
       AND (a.value IS NOT NULL OR (lp.product_id IS NOT NULL AND nullif(it.value->>'id','') = lp.product_id::text))
     GROUP BY lp.id
  ) m WHERE m.matched = jsonb_array_length(p_items);
  IF v_fee IS NOT NULL THEN
    v_server_delivery_fee := floor(v_fee);
  END IF;

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
$function$
;
