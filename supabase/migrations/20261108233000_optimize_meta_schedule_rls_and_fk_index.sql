-- Safe query-plan optimization only: preserve all Meta schedule permissions.
drop policy if exists "Admins can view Meta ad schedules" on public.meta_ad_schedules;
create policy "Admins can view Meta ad schedules"
on public.meta_ad_schedules for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (array['admin'::public.app_role, 'super_admin'::public.app_role])
  )
);

drop policy if exists "Admins can create Meta ad schedules" on public.meta_ad_schedules;
create policy "Admins can create Meta ad schedules"
on public.meta_ad_schedules for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (array['admin'::public.app_role, 'super_admin'::public.app_role])
  )
);

drop policy if exists "Admins can cancel pending Meta ad schedules" on public.meta_ad_schedules;
create policy "Admins can cancel pending Meta ad schedules"
on public.meta_ad_schedules for update to authenticated
using (
  status = 'pending'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (array['admin'::public.app_role, 'super_admin'::public.app_role])
  )
)
with check (
  status = 'cancelled'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = any (array['admin'::public.app_role, 'super_admin'::public.app_role])
  )
);

create index if not exists meta_ad_schedules_created_by_idx
  on public.meta_ad_schedules (created_by);
