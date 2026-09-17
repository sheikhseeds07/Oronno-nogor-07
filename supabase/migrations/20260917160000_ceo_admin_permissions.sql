ALTER TABLE public.employee_permissions
  ADD COLUMN IF NOT EXISTS attendance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employees BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banners BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coupons BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE allowed BOOLEAN; sql TEXT;
BEGIN
  IF public.has_role(_user_id, 'super_admin') THEN RETURN true; END IF;
  IF _module !~ '^[a-z_]+$' THEN RETURN false; END IF;
  sql := format('SELECT COALESCE(%I, false) FROM public.employee_permissions WHERE user_id = $1', _module);
  EXECUTE sql INTO allowed USING _user_id;
  RETURN COALESCE(allowed, false);
END $$;

CREATE OR REPLACE FUNCTION public.is_full_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;
