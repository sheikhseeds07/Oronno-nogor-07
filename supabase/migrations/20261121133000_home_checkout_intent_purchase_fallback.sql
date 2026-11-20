-- Home checkout shares the durable seed-first intent pipeline.
-- If the customer closes the tab before the browser can finalize, the scheduled
-- fallback still creates the seed-only order and dispatches the same idempotent
-- Purchase event using the intent's saved Meta click identifiers.
CREATE OR REPLACE FUNCTION public.finalize_expired_landing_checkout_intents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_order_id uuid;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM public.landing_checkout_intents
    WHERE state = 'pending' AND expires_at <= now()
    ORDER BY expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  LOOP
    BEGIN
      v_order_id := public.finalize_landing_checkout_intent(r.id, false);
      IF v_order_id IS NOT NULL THEN
        -- dispatch_landing_purchase verifies the finalized intent/order pair;
        -- the Purchase event_id is the order UUID, so retries are deduplicated.
        PERFORM public.dispatch_landing_purchase(r.id, v_order_id);
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'expired checkout intent % fallback failed: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_expired_landing_checkout_intents() FROM PUBLIC, anon, authenticated;
