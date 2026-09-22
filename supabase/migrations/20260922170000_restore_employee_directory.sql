-- Restore secure employee directory listing without relying on RLS-sensitive direct table reads.
CREATE OR REPLACE FUNCTION public.list_employees_full()
RETURNS TABLE (
  id uuid, name text, phone text, email text, "position" text, is_active boolean,
  created_at timestamptz, user_id uuid, role public.app_role, permissions jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'employees')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT e.id,e.name,e.phone,e.email,e."position",e.is_active,e.created_at,e.user_id,
    COALESCE((SELECT ur.role FROM public.user_roles ur WHERE ur.user_id=e.user_id
      ORDER BY CASE ur.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'employee' THEN 3 ELSE 4 END LIMIT 1),
      'employee'::public.app_role),
    COALESCE(to_jsonb(ep)-'user_id','{}'::jsonb)
  FROM public.employees e
  LEFT JOIN public.employee_permissions ep ON ep.user_id=e.user_id
  ORDER BY e.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_employees_full() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_employees_full() TO authenticated, service_role;