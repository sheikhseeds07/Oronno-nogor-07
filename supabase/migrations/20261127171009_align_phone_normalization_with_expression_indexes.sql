-- Keep phone normalization semantics, but use the same E-string regex
-- as the existing phone expression indexes so PostgreSQL can use them.

CREATE OR REPLACE FUNCTION public.phone_repeat_wait_minutes(p_phone text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_min int; v_last timestamptz;
  v_d text := right(regexp_replace(coalesce(p_phone,''), E'\\D', '', 'g'),10);
BEGIN
  SELECT greatest(0, least(10080, coalesce(nullif(settings->>'order_repeat_phone_minutes','')::int, nullif(settings->>'order_phone_repeat_minutes','')::int, 0)))
  INTO v_min FROM public.site_settings LIMIT 1;
  IF coalesce(v_min,0)=0 OR length(v_d)<10 THEN RETURN 0; END IF;
  SELECT max(created_at) INTO v_last FROM public.orders
  WHERE right(regexp_replace(coalesce(customer_phone,''), E'\\D', '', 'g'),10)=v_d;
  IF v_last IS NULL OR v_last + make_interval(mins=>v_min) <= now() THEN RETURN 0; END IF;
  RETURN greatest(1, ceil(extract(epoch FROM (v_last + make_interval(mins=>v_min) - now()))/60.0)::int);
END
$function$;

CREATE OR REPLACE FUNCTION public.staff_customer_history(_phone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE last9 text; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()) THEN RETURN '[]'::jsonb; END IF;
  last9 := right(regexp_replace(coalesce(_phone, ''), E'\\D', '', 'g'), 9);
  IF length(last9) < 9 THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT o.id, o.invoice_no, o.status, o.total, o.created_at,
      o.customer_name, o.customer_phone, o.customer_address, o.thana, o.district, o.source,
      coalesce((SELECT jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity))
        FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE right(regexp_replace(coalesce(o.customer_phone, ''), E'\\D', '', 'g'), 9) = last9
    ORDER BY o.created_at DESC LIMIT 200
  ) t;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_customer_order_history(p_phone text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_digits text; v_local text; v_intl text; v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT (public.is_admin((SELECT auth.uid())) OR public.has_permission((SELECT auth.uid()), 'orders')
      OR public.has_permission((SELECT auth.uid()), 'web_orders')) THEN
    RAISE EXCEPTION 'Order history permission required';
  END IF;
  v_digits := regexp_replace(coalesce(p_phone, ''), E'\\D', '', 'g');
  IF left(v_digits, 2) = '88' AND length(v_digits) = 13 THEN v_local := substr(v_digits, 3);
  ELSE v_local := v_digits; END IF;
  IF length(v_local) = 10 THEN v_local := '0' || v_local; END IF;
  v_intl := CASE WHEN left(v_local, 1) = '0' THEN '88' || v_local ELSE v_local END;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'invoice_no', o.invoice_no, 'status', o.status::text, 'total', o.total,
    'created_at', o.created_at, 'customer_name', o.customer_name, 'customer_address', o.customer_address,
    'thana', o.thana, 'district', o.district,
    'order_items', coalesce((SELECT jsonb_agg(jsonb_build_object('product_name', oi.product_name, 'quantity', oi.quantity) ORDER BY oi.id)
      FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
  ) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_result FROM public.orders o
  WHERE regexp_replace(coalesce(o.customer_phone, ''), E'\\D', '', 'g') IN (v_local, v_intl);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_incomplete_conversion_event_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_order_id uuid;
BEGIN
  IF lower(btrim(coalesce(NEW.event, ''))) <> 'converted' THEN RETURN NEW; END IF;
  IF v_actor IS NULL OR NOT public.has_permission(v_actor, 'orders') THEN RETURN NEW; END IF;
  SELECT o.id INTO v_order_id FROM public.orders o
  WHERE regexp_replace(coalesce(o.customer_phone, ''), E'\\D', '', 'g') = regexp_replace(coalesce(NEW.phone, ''), E'\\D', '', 'g')
    AND o.created_by = v_actor AND o.status::text IN ('web_pending', 'pending')
    AND o.created_at >= NEW.created_at - interval '5 minutes'
    AND o.created_at <= NEW.created_at + interval '30 seconds'
  ORDER BY o.created_at DESC LIMIT 1;
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders SET source = 'incomplete', originated_from_incomplete = true WHERE id = v_order_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.block_incomplete_for_active_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF public.phone_repeat_wait_minutes(NEW.phone) > 0 THEN RETURN NULL; END IF;
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> ''
     AND EXISTS (SELECT 1 FROM public.orders o
       WHERE regexp_replace(coalesce(o.customer_phone,''), E'\\D', '', 'g') = regexp_replace(NEW.phone, E'\\D', '', 'g')
       AND o.status::text NOT IN ('delivered','cancelled','rts')) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_incomplete_for_active_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NEW.customer_phone IS NOT NULL AND btrim(NEW.customer_phone) <> ''
     AND NEW.status::text NOT IN ('delivered', 'cancelled', 'rts') THEN
    DELETE FROM public.incomplete_orders
    WHERE regexp_replace(coalesce(phone, ''), E'\\D', '', 'g') = regexp_replace(NEW.customer_phone, E'\\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.promote_stale_incomplete_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
DECLARE r record; new_id uuid; promoted int := 0; subtotal_calc numeric; fee numeric; total_calc numeric; v_marketing_source text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'incomplete_orders' AND c.relkind = 'r') THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM public.incomplete_orders
    WHERE created_at <= now() - interval '20 minutes' ORDER BY created_at ASC LIMIT 200 FOR UPDATE SKIP LOCKED
  LOOP
    IF public.phone_repeat_wait_minutes(r.phone) > 0 THEN
      DELETE FROM public.incomplete_orders WHERE id = r.id; CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.orders o
      WHERE regexp_replace(o.customer_phone, E'\\D', '', 'g') = regexp_replace(r.phone, E'\\D', '', 'g')
      AND o.created_at >= r.created_at) THEN
      DELETE FROM public.incomplete_orders WHERE id = r.id; CONTINUE;
    END IF;
    IF r.items IS NULL OR jsonb_typeof(r.items) <> 'array' OR jsonb_array_length(r.items) = 0 THEN CONTINUE; END IF;
    SELECT coalesce(sum((coalesce(i->>'price', '0'))::numeric * greatest(1, (coalesce(i->>'quantity', '1'))::numeric)), 0)
    INTO subtotal_calc FROM jsonb_array_elements(r.items) AS i;
    fee := coalesce(r.delivery_fee, 0);
    total_calc := coalesce(nullif(r.total, 0), subtotal_calc + fee);
    v_marketing_source := CASE WHEN r.marketing_source IN ('facebook_ads','tiktok_ads','organic','direct','manual_order')
      THEN r.marketing_source ELSE public.classify_marketing_source(r.source_url) END;
    INSERT INTO public.orders (customer_name, customer_phone, customer_address, thana, district, notes,
      subtotal, delivery_fee, discount, total, source, status, payment_method, originated_from_incomplete, marketing_source)
    VALUES (coalesce(nullif(btrim(coalesce(r.customer_name, '')), ''), r.phone), r.phone, r.customer_address,
      NULL, r.delivery_zone, r.note, subtotal_calc, fee, 0, total_calc, 'incomplete', 'web_pending', 'cod',
      true, coalesce(v_marketing_source, 'unknown')) RETURNING id INTO new_id;
    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, price, subtotal)
    SELECT new_id, NULL, coalesce(nullif(btrim(coalesce(i->>'name', '')), ''), 'Item'),
      greatest(1, (coalesce(i->>'quantity', '1'))::int), (coalesce(i->>'price', '0'))::numeric,
      (coalesce(i->>'price', '0'))::numeric * greatest(1, (coalesce(i->>'quantity', '1'))::int)
    FROM jsonb_array_elements(r.items) AS i;
    IF to_regclass('public.incomplete_events') IS NOT NULL THEN
      BEGIN INSERT INTO public.incomplete_events (phone, event) VALUES (r.phone, 'converted');
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    DELETE FROM public.incomplete_orders WHERE id = r.id;
    promoted := promoted + 1;
  END LOOP;
  RETURN promoted;
END;
$function$;