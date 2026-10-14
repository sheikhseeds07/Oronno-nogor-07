-- Preserve the configured price for a published landing-page offer when its
-- product catalogue price differs. Normal catalogue orders still use DB pricing.
DO $migration$
DECLARE
  r record;
  v_def text;
  v_old text := 'v_input_price := coalesce(v_db_price, v_input_price);';
  v_new text := $replacement$
    IF v_product_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.landing_pages lp
      WHERE lp.is_published = true
        AND (
          (lp.product_id = v_product_id
           AND coalesce(nullif(lp.sale_price, 0), lp.regular_price) = v_input_price)
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(lp.addons) = 'array' THEN lp.addons ELSE '[]'::jsonb END
            ) a
            WHERE a->>'product_id' = v_product_id::text
              AND trim(a->>'name') = trim(v_product_name)
              AND coalesce(nullif(a->>'price','')::numeric, -1) = v_input_price
          )
        )
    ) THEN
      -- Published landing offer price is authoritative for this matching offer.
      NULL;
    ELSE
      v_input_price := coalesce(v_db_price, v_input_price);
    END IF;
  $replacement$;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'place_public_order'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position(v_old in v_def) = 0 THEN
      RAISE EXCEPTION 'Expected price override line not found in place_public_order(%)', r.args;
    END IF;
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END LOOP;
END
$migration$;

-- Repair the one audited order whose offer price was stored incorrectly.
-- This is guarded by the exact order/product/current price to avoid unrelated edits.
UPDATE public.order_items oi
SET price = 400, subtotal = 400 * oi.quantity
FROM public.orders o
WHERE oi.order_id = o.id
  AND o.id = '1841f910-2f84-4c35-b035-04049f4ad999'::uuid
  AND oi.product_id = '8ae955d4-8e2b-4b25-a7aa-d7eabf93e83a'::uuid
  AND oi.product_name = '২৪ প্রকার সবজির কম্বো ২ প্যাকেট'
  AND oi.price = 350
  AND oi.quantity = 1;
