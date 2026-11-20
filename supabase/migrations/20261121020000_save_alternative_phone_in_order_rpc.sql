DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='place_public_order' AND p.pronargs=8
  ORDER BY p.oid DESC LIMIT 1;

  IF v_def IS NULL THEN RAISE EXCEPTION '8-argument place_public_order not found'; END IF;
  v_def := replace(v_def,
    'p_device_id text DEFAULT NULL::text)',
    'p_device_id text DEFAULT NULL::text, p_alternative_phone text DEFAULT NULL::text)');
  v_def := replace(v_def,
    '  IF p_customer_address IS NULL OR length(trim(p_customer_address)) < 1 OR length(p_customer_address) > 1000 THEN',
    '  IF nullif(trim(coalesce(p_alternative_phone, '''')), '''') IS NOT NULL AND p_alternative_phone !~ ''^01[3-9][0-9]{8}$'' THEN RAISE EXCEPTION ''বিকল্প নাম্বার সঠিক নয়''; END IF;' || chr(10) ||
    '  IF p_customer_address IS NULL OR length(trim(p_customer_address)) < 1 OR length(p_customer_address) > 1000 THEN');
  v_def := replace(v_def,
    'originated_from_incomplete, client_ip, device_id',
    'originated_from_incomplete, client_ip, device_id, alternative_phone');
  v_def := replace(v_def,
    'nullif(trim(coalesce(p_client_ip,'''')), ''''), v_device_id',
    'nullif(trim(coalesce(p_client_ip,'''')), ''''), v_device_id, nullif(trim(coalesce(p_alternative_phone,'''')), '''')');
  v_def := replace(v_def,
    '    IF v_recent IS NOT NULL THEN RETURN v_recent; END IF;',
    '    IF v_recent IS NOT NULL THEN UPDATE public.orders SET alternative_phone = nullif(trim(coalesce(p_alternative_phone,'''')), '''') WHERE id = v_recent; RETURN v_recent; END IF;');
  IF position('p_alternative_phone text DEFAULT NULL::text' in v_def)=0
     OR position('device_id, alternative_phone' in v_def)=0
     OR position('v_device_id, nullif(trim(coalesce(p_alternative_phone' in v_def)=0
  THEN RAISE EXCEPTION 'Could not safely patch place_public_order definition'; END IF;
  EXECUTE v_def;
END $$;
