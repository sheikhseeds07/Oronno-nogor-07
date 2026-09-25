create or replace function public.employee_monthly_bonus_progress()
returns table (
  employee_name text,
  confirmed bigint,
  delivered bigint,
  cancelled bigint,
  target bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  with me as (
    select (select auth.uid()) as user_id
  ),
  allowed as (
    select 1
    from public.user_roles ur
    join public.employee_permissions ep on ep.user_id = ur.user_id
    where ur.user_id = (select user_id from me)
      and ur.role = 'employee'
      and ep.dash_employee_perf = true
    limit 1
  ),
  bounds as (
    select
      date_trunc('month', timezone('Asia/Dhaka', now())) at time zone 'Asia/Dhaka' as month_start,
      (date_trunc('month', timezone('Asia/Dhaka', now())) + interval '1 month') at time zone 'Asia/Dhaka' as next_month
  ),
  confirmed_ids as (
    select distinct e.order_id
    from public.order_action_events e
    cross join bounds b
    where e.actor_id = (select user_id from me)
      and e.action = 'confirm'
      and e.created_at >= b.month_start
      and e.created_at < b.next_month
  ),
  order_rows as (
    select o.id,
           lower(o.source::text) as source,
           lower(o.status::text) as status,
           coalesce(o.originated_from_import, false) as imported,
           o.notes
    from public.orders o
    join confirmed_ids c on c.order_id = o.id
    union all
    select d.id,
           lower((d.order_data->>'source')) as source,
           lower(coalesce(d.original_status::text, d.order_data->>'status')) as status,
           coalesce((d.order_data->>'originated_from_import')::boolean, false) as imported,
           d.order_data->>'notes' as notes
    from public.deleted_orders d
    join confirmed_ids c on c.order_id = d.id
    where not exists (select 1 from public.orders o2 where o2.id = d.id)
  ),
  incomplete as (
    select *
    from order_rows
    where source = 'incomplete'
      and not imported
      and coalesce(notes, '') !~* '(?:^|\s)Ref\s*:'
  ),
  emp as (
    select coalesce(e.name, p.full_name, 'আপনি') as name
    from me
    left join public.employees e on e.user_id = me.user_id
    left join public.profiles p on p.id = me.user_id
  )
  select
    (select name from emp),
    count(*)::bigint,
    count(*) filter (where status = 'delivered')::bigint,
    count(*) filter (where status in ('cancelled','canceled'))::bigint,
    300::bigint
  from incomplete
  where exists (select 1 from allowed);
$$;

revoke all on function public.employee_monthly_bonus_progress() from public;
grant execute on function public.employee_monthly_bonus_progress() to authenticated;
