-- CEO-controlled Admin permissions: one checkbox per top-level Admin module.
ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS dashboard BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS import_orders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banners BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coupons BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employees BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attendance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_pages BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS all_api BOOLEAN NOT NULL DEFAULT false;

-- CEO bypasses permissions; Admin/Employee are checked against their saved module permission.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE allowed BOOLEAN;
BEGIN
  IF public.has_role(_user_id, 'super_admin') THEN
    RETURN true;
  END IF;
  IF _module !~ '^[a-z_]+$' THEN
    RETURN false;
  END IF;
  EXECUTE format(
    'SELECT COALESCE(%I, false) FROM public.employee_permissions WHERE user_id = $1',
    _module
  ) INTO allowed USING _user_id;
  RETURN COALESCE(allowed, false);
END;
$$;

-- Top-level module RLS follows the same CEO-controlled permissions.
DROP POLICY IF EXISTS "employees_admin" ON public.employees;
CREATE POLICY "employees_permission" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'employees'))
  WITH CHECK (public.has_permission(auth.uid(), 'employees'));

DROP POLICY IF EXISTS "site_settings_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_permission_write" ON public.site_settings
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'settings'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings'));

DROP POLICY IF EXISTS "banners_admin_write" ON public.banners;
CREATE POLICY "banners_permission_write" ON public.banners
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'banners'))
  WITH CHECK (public.has_permission(auth.uid(), 'banners'));

DROP POLICY IF EXISTS "coupons_admin_write" ON public.coupons;
CREATE POLICY "coupons_permission_write" ON public.coupons
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'coupons'))
  WITH CHECK (public.has_permission(auth.uid(), 'coupons'));

DROP POLICY IF EXISTS "landing_admin_write" ON public.landing_pages;
CREATE POLICY "landing_permission_write" ON public.landing_pages
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'landing_pages'))
  WITH CHECK (public.has_permission(auth.uid(), 'landing_pages'));

-- Attendance remains self-only for Admin/Employee; CEO can see all via the function layer.
DROP POLICY IF EXISTS attendance_self_read ON public.attendance;
CREATE POLICY attendance_self_read ON public.attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS attendance_self_insert ON public.attendance;
CREATE POLICY attendance_self_insert ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS attendance_self_update ON public.attendance;
CREATE POLICY attendance_self_update ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS attendance_admin_delete ON public.attendance;
CREATE POLICY attendance_admin_delete ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
