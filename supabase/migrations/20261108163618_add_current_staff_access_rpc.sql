create or replace function public.get_my_staff_access()
returns jsonb
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with role_cte as (
    select ur.role::text as role
    from public.user_roles ur
    where ur.user_id = auth.uid()
    order by case ur.role::text
      when 'super_admin' then 1
      when 'admin' then 2
      when 'employee' then 3
      else 4
    end
    limit 1
  )
  select jsonb_build_object(
    'role', (select role from role_cte),
    'permissions', case
      when (select role from role_cte) = 'super_admin' then null
      else (
        select to_jsonb(ep)
        from public.employee_permissions ep
        where ep.user_id = auth.uid()
        limit 1
      )
    end
  );
$function$;

revoke all on function public.get_my_staff_access() from public, anon;
grant execute on function public.get_my_staff_access() to authenticated, service_role;
