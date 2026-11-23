ALTER TABLE public.customer_blocks
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS block_type text NOT NULL DEFAULT 'phone';

UPDATE public.customer_blocks
SET block_type = CASE WHEN device_id IS NOT NULL THEN 'device' ELSE 'phone' END
WHERE block_type IS DISTINCT FROM CASE WHEN device_id IS NOT NULL THEN 'device' ELSE 'phone' END;

-- Retain legacy IP-only rows for audit, but stop enforcing shared-IP blocks.
UPDATE public.customer_blocks
SET is_active = false, unblocked_at = COALESCE(unblocked_at, now())
WHERE is_active AND phone IS NULL AND device_id IS NULL AND ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_blocks_active_phone_idx
  ON public.customer_blocks (phone) WHERE is_active AND block_type = 'phone' AND phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_blocks_active_device_idx
  ON public.customer_blocks (device_id) WHERE is_active AND block_type = 'device' AND device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_blocked_visitor(p_ip text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.customer_blocks b
    WHERE b.is_active AND b.block_type = 'phone'
      AND p_phone IS NOT NULL AND b.phone = public.normalize_bd_phone(p_phone))
$function$;

CREATE OR REPLACE FUNCTION public.is_blocked_device(p_device_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.customer_blocks b
    WHERE b.is_active AND b.block_type = 'device'
      AND b.device_id = nullif(trim(coalesce(p_device_id, '')), ''))
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_block(p_phone text DEFAULT NULL, p_device_id text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS SETOF public.customer_blocks LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_phone text := public.normalize_bd_phone(p_phone);
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_row public.customer_blocks;
  v_by text := COALESCE(auth.email(), 'Admin');
BEGIN
  IF NOT public.can_manage_customer_blocks() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_phone IS NULL AND v_device IS NULL THEN RAISE EXCEPTION 'Phone or device required'; END IF;
  IF v_device IS NOT NULL AND char_length(v_device) NOT BETWEEN 6 AND 80 THEN RAISE EXCEPTION 'Invalid device identifier'; END IF;
  IF v_phone IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('customer-phone-block:' || v_phone));
    SELECT * INTO v_row FROM public.customer_blocks WHERE is_active AND block_type='phone' AND phone=v_phone ORDER BY blocked_at DESC LIMIT 1;
    IF v_row.id IS NULL THEN
      INSERT INTO public.customer_blocks(customer_name,phone,block_type,is_active,blocked_by)
      VALUES(p_name,v_phone,'phone',true,v_by) RETURNING * INTO v_row;
    ELSE
      UPDATE public.customer_blocks SET customer_name=COALESCE(p_name,customer_name),blocked_at=now(),unblocked_at=NULL,blocked_by=v_by
      WHERE id=v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN NEXT v_row;
  END IF;
  IF v_device IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('customer-device-block:' || v_device));
    SELECT * INTO v_row FROM public.customer_blocks WHERE is_active AND block_type='device' AND device_id=v_device ORDER BY blocked_at DESC LIMIT 1;
    IF v_row.id IS NULL THEN
      INSERT INTO public.customer_blocks(customer_name,device_id,block_type,is_active,blocked_by)
      VALUES(p_name,v_device,'device',true,v_by) RETURNING * INTO v_row;
    ELSE
      UPDATE public.customer_blocks SET customer_name=COALESCE(p_name,customer_name),blocked_at=now(),unblocked_at=NULL,blocked_by=v_by
      WHERE id=v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN NEXT v_row;
  END IF;
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_customer_blocks_v2()
RETURNS TABLE(id uuid,customer_name text,phone text,ip_address text,device_id text,block_type text,is_active boolean,blocked_at timestamptz,unblocked_at timestamptz,blocked_by text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
  SELECT b.id,b.customer_name,b.phone,b.ip_address,b.device_id,b.block_type,b.is_active,b.blocked_at,b.unblocked_at,b.blocked_by
  FROM public.customer_blocks b
  WHERE b.is_active AND b.block_type IN ('phone','device') AND public.can_manage_customer_blocks()
  ORDER BY b.blocked_at DESC
$function$;

CREATE OR REPLACE FUNCTION public.unblock_customer_v2(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT public.can_manage_customer_blocks() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.customer_blocks SET is_active=false,unblocked_at=now(),blocked_by=COALESCE(auth.email(),blocked_by,'Admin')
  WHERE id=p_id AND is_active;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_site_block_status(p_ip text DEFAULT NULL,p_device_id text DEFAULT NULL,p_customer_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
BEGIN
  IF v_device_id IS NOT NULL AND char_length(v_device_id) BETWEEN 6 AND 80
    AND public.is_blocked_device(v_device_id) THEN RETURN true; END IF;
  -- Keep the independent account-ban behavior; customer_blocks never use IP.
  IF p_customer_id IS NOT NULL AND v_user_id=p_customer_id THEN
    IF v_device_id IS NOT NULL AND char_length(v_device_id) BETWEEN 6 AND 80 THEN
      INSERT INTO public.customer_devices(customer_id,device_id,last_seen_at)
      VALUES(p_customer_id,v_device_id,now())
      ON CONFLICT(customer_id,device_id) DO UPDATE SET last_seen_at=excluded.last_seen_at;
    END IF;
    IF EXISTS(SELECT 1 FROM public.customer_profiles cp WHERE cp.id=p_customer_id AND cp.is_blocked IS TRUE) THEN RETURN true; END IF;
  ELSIF p_customer_id IS NOT NULL AND v_device_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.customer_devices cd WHERE cd.customer_id=p_customer_id AND cd.device_id=v_device_id)
    AND EXISTS(SELECT 1 FROM public.customer_profiles cp WHERE cp.id=p_customer_id AND cp.is_blocked IS TRUE) THEN
    RETURN true;
  END IF;
  IF v_device_id IS NOT NULL AND char_length(v_device_id) BETWEEN 6 AND 80
    AND EXISTS(SELECT 1 FROM public.customer_devices cd JOIN public.customer_profiles cp ON cp.id=cd.customer_id
      WHERE cd.device_id=v_device_id AND cp.is_blocked IS TRUE) THEN RETURN true; END IF;
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.is_blocked_device(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_device(text) TO service_role;
REVOKE ALL ON FUNCTION public.create_customer_block(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_customer_block(text,text,text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.list_customer_blocks_v2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_customer_blocks_v2() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.unblock_customer_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.unblock_customer_v2(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_site_block_status(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_block_status(text,text,uuid) TO anon,authenticated,service_role;
