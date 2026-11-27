-- Remove the writable public schema from SECURITY DEFINER search paths.
-- All application tables/types/function references below are schema-qualified.
CREATE OR REPLACE FUNCTION public.assign_order_round_robin(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user uuid;
  v_next integer;
  v_pos integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('order_distribution_round_robin'));

  SELECT next_position INTO v_next
  FROM public.order_distribution_state
  WHERE id = true
  FOR UPDATE;

  SELECT user_id, position INTO v_user, v_pos
  FROM public.order_distribution_members
  WHERE enabled = true AND position >= v_next
  ORDER BY position
  LIMIT 1;

  IF v_user IS NULL THEN
    SELECT user_id, position INTO v_user, v_pos
    FROM public.order_distribution_members
    WHERE enabled = true
    ORDER BY position
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.orders
  SET assigned_to = v_user, updated_at = now()
  WHERE id = p_order_id;

  SELECT coalesce(min(position), 0) INTO v_next
  FROM public.order_distribution_members
  WHERE enabled = true AND position > v_pos;

  IF NOT EXISTS (
    SELECT 1 FROM public.order_distribution_members
    WHERE enabled = true AND position > v_pos
  ) THEN
    SELECT coalesce(min(position), 0) INTO v_next
    FROM public.order_distribution_members
    WHERE enabled = true;
  END IF;

  UPDATE public.order_distribution_state
  SET next_position = v_next, updated_at = now()
  WHERE id = true;

  RETURN v_user;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_order_from_incomplete_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  matched_order_id uuid;
BEGIN
  IF NEW.event = 'converted' THEN
    SELECT o.id INTO matched_order_id
    FROM public.orders o
    WHERE regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g') =
          regexp_replace(coalesce(NEW.phone, ''), '\\D', '', 'g')
      AND coalesce(o.originated_from_incomplete, false) = false
      AND coalesce(o.source::text, '') IN ('web', 'manual')
      AND o.created_at <= coalesce(NEW.created_at, now())
      AND o.created_at >= coalesce(NEW.created_at, now()) - interval '2 minutes'
      AND o.status IN ('web_pending', 'pending')
    ORDER BY o.created_at DESC
    LIMIT 1;

    IF matched_order_id IS NOT NULL THEN
      UPDATE public.orders
      SET originated_from_incomplete = true,
          source = 'incomplete'::public.order_source
      WHERE id = matched_order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DO $hardening$
DECLARE
  r record;
  v_config text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
        WHERE setting LIKE 'search_path=%public%'
      )
  LOOP
    v_config := array_to_string(r.proconfig, ',');
    IF v_config LIKE '%extensions%' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, extensions', r.oid::regprocedure);
    ELSIF v_config LIKE '%storage%' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, storage', r.oid::regprocedure);
    ELSE
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog', r.oid::regprocedure);
    END IF;
  END LOOP;
END;
$hardening$;
