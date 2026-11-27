-- Keep the Methi Mix landing-page offer price authoritative when creating order items.
-- The product catalog row can legitimately retain its old base price; for this
-- one landing page, accept landing_pages.sale_price as the order price as well.
DO $$
DECLARE
  v_def text;
  v_old text := $old$AND coalesce(nullif(a->>'price','')::numeric, -1) = v_input_price)$old$;
  v_new text := $new$AND (coalesce(nullif(a->>'price','')::numeric, -1) = v_input_price OR (lp.slug = 'methi-mix' AND coalesce(nullif(lp.sale_price, 0), lp.regular_price) = v_input_price)))$new$;
BEGIN
  SELECT pg_get_functiondef('public.place_public_order(text,text,text,numeric,jsonb,text,text,text,text)'::regprocedure)
    INTO v_def;
  IF position(v_old in v_def) = 0 THEN
    IF position(v_new in v_def) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Expected Methi Mix price guard was not found; migration aborted';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END
$$;

-- Keep the configured package price and its addon editor value aligned.
UPDATE public.landing_pages
SET addons = jsonb_set(addons, '{0,price}', to_jsonb(sale_price), false)
WHERE slug = 'methi-mix'
  AND jsonb_typeof(addons) = 'array'
  AND jsonb_array_length(addons) > 0
  AND sale_price IS NOT NULL
  AND (addons->0->>'price')::numeric IS DISTINCT FROM sale_price;
