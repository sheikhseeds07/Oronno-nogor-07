CREATE OR REPLACE FUNCTION public.lookup_checkout_customer_by_phone(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_digits text;
  v_local text;
  v_intl text;
  v_result jsonb;
BEGIN
  v_digits := regexp_replace(coalesce(p_phone, ''), E'\\D', '', 'g');
  IF length(v_digits) < 11 OR length(v_digits) > 13 THEN RETURN NULL; END IF;

  IF left(v_digits, 3) = '880' AND length(v_digits) = 13 THEN
    v_local := '0' || substr(v_digits, 4);
  ELSIF left(v_digits, 2) = '88' AND length(v_digits) = 13 THEN
    v_local := '0' || substr(v_digits, 3);
  ELSE
    v_local := v_digits;
  END IF;

  IF length(v_local) <> 11 OR v_local !~ '^01[3-9][0-9]{8}$' THEN RETURN NULL; END IF;
  v_intl := '88' || v_local;

  SELECT jsonb_build_object('name', o.customer_name, 'address', o.customer_address)
    INTO v_result
  FROM public.orders o
  WHERE regexp_replace(coalesce(o.customer_phone, ''), E'\\D', '', 'g') IN (v_local, v_intl)
  ORDER BY o.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$function$;