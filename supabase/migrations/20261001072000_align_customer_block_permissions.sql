-- Order staff need this action from the order details panel. Keep the
-- authorization decision in the database because these RPCs are security
-- definer functions.
create or replace function public.can_manage_customer_blocks()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text in ('admin', 'super_admin')
    )
    or exists (
      select 1
      from public.employee_permissions ep
      where ep.user_id = auth.uid()
        and (
          coalesce((to_jsonb(ep) ->> 'orders')::boolean, false)
          or coalesce((to_jsonb(ep) ->> 'customers')::boolean, false)
          or coalesce((to_jsonb(ep) ->> 'customer_management')::boolean, false)
        )
    );
$$;

revoke all on function public.can_manage_customer_blocks() from public, anon;
grant execute on function public.can_manage_customer_blocks() to authenticated, service_role;