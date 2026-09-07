-- Admin-only customer management fields. Existing customer data and behavior remain unchanged.
alter table public.customer_profiles add column if not exists is_blocked boolean not null default false;
alter table public.customer_profiles add column if not exists blocked_at timestamptz;
alter table public.customer_profiles add column if not exists blocked_reason text;
create index if not exists customer_profiles_blocked_idx on public.customer_profiles(is_blocked, created_at desc);

drop policy if exists cp_admin_read on public.customer_profiles;
create policy cp_admin_read on public.customer_profiles
for select to authenticated
using (
  auth.uid() = id
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','super_admin'))
);

drop policy if exists cp_admin_update on public.customer_profiles;
create policy cp_admin_update on public.customer_profiles
for update to authenticated
using (
  auth.uid() = id
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','super_admin'))
)
with check (
  auth.uid() = id
  or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','super_admin'))
);
