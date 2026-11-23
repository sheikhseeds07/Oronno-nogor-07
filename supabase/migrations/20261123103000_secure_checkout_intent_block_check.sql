-- Check a checkout intent's block status without exposing customer PII or granting table SELECT.
CREATE OR REPLACE FUNCTION public.is_landing_checkout_intent_blocked(p_intent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN i.id IS NULL THEN false
    ELSE public.is_blocked_visitor(NULL, i.customer_phone)
      OR public.is_blocked_device(i.device_id)
  END
  FROM (SELECT 1) seed
  LEFT JOIN public.landing_checkout_intents i ON i.id = p_intent_id
$$;

REVOKE ALL ON FUNCTION public.is_landing_checkout_intent_blocked(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_landing_checkout_intent_blocked(uuid) TO anon, authenticated, service_role;
