-- Only the CEO (super_admin) bypasses granular permissions.
-- Admin and employee roles must hold the explicit checkbox permission.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE allowed BOOLEAN; sql TEXT;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(_user_id) THEN RETURN true; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'employee')
  ) THEN RETURN false; END IF;
  IF _module !~ '^[a-z_]+$' THEN RETURN false; END IF;
  sql := format('SELECT COALESCE(%I, false) FROM public.employee_permissions WHERE user_id = $1', _module);
  EXECUTE sql INTO allowed USING _user_id;
  RETURN COALESCE(allowed, false);
END $function$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- Integrations and site settings now follow their own checkbox instead of the blanket admin role.
DROP POLICY IF EXISTS integrations_admin ON public.integrations;
CREATE POLICY integrations_admin ON public.integrations
  FOR ALL TO authenticated
  USING (public.has_permission((SELECT auth.uid()), 'integrations'))
  WITH CHECK (public.has_permission((SELECT auth.uid()), 'integrations'));

DROP POLICY IF EXISTS site_settings_admin_write ON public.site_settings;
CREATE POLICY site_settings_admin_write ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_permission((SELECT auth.uid()), 'settings'))
  WITH CHECK (public.has_permission((SELECT auth.uid()), 'settings'));

-- Offer rows are managed from the Offers screen.
DROP POLICY IF EXISTS offer_items_staff_write ON public.offer_items;
CREATE POLICY offer_items_staff_write ON public.offer_items
  FOR ALL TO authenticated
  USING (public.has_permission((SELECT auth.uid()), 'offers') OR public.has_permission((SELECT auth.uid()), 'products'))
  WITH CHECK (public.has_permission((SELECT auth.uid()), 'offers') OR public.has_permission((SELECT auth.uid()), 'products'));
