-- Fix customer profile media setup and customer order history access.
-- Keeps existing OTP, order creation, admin, and community logic intact.

-- Ensure the profile media bucket exists in every environment.
insert into storage.buckets (id, name, public)
values ('customer-profiles', 'customer-profiles', true)
on conflict (id) do update set public = true;

drop policy if exists customer_profile_media_insert on storage.objects;
create policy customer_profile_media_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists customer_profile_media_update on storage.objects;
create policy customer_profile_media_update
on storage.objects for update to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists customer_profile_media_delete on storage.objects;
create policy customer_profile_media_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'customer-profiles'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists customer_profile_media_read on storage.objects;
create policy customer_profile_media_read
on storage.objects for select to public
using (bucket_id = 'customer-profiles');

-- Orders are protected by staff-oriented RLS, so the customer-facing RPC must
-- run as a definer while still restricting results to the authenticated user's
-- own id/phone. This also includes cancelled orders because no status filter is used.
create or replace function public.get_my_customer_orders()
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.orders o
  where auth.uid() is not null
    and (
      o.created_by = auth.uid()
      or regexp_replace(coalesce(o.customer_phone,''), '[^0-9]', '', 'g') = regexp_replace(coalesce((select cp.phone from public.customer_profiles cp where cp.id = auth.uid() limit 1),''), '[^0-9]', '', 'g')
      or regexp_replace(regexp_replace(coalesce(o.customer_phone,''), '[^0-9]', '', 'g'), '^88', '') = regexp_replace(regexp_replace(coalesce((select cp.phone from public.customer_profiles cp where cp.id = auth.uid() limit 1),''), '[^0-9]', '', 'g'), '^88', '')
    )
  order by o.created_at desc;
$$;

revoke all on function public.get_my_customer_orders() from public;
grant execute on function public.get_my_customer_orders() to authenticated;
