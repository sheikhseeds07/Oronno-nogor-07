-- Fix customer profile media, profile fields and customer order history access.
-- Keeps existing OTP, order creation, admin, and community logic intact.

alter table public.customer_profiles add column if not exists bio text;
alter table public.customer_profiles add column if not exists cover_url text;
create index if not exists idx_customer_profiles_phone on public.customer_profiles(phone);
create index if not exists idx_product_reviews_user_id on public.product_reviews(user_id);

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

-- Orders are protected by staff-oriented RLS, so the customer-facing RPC runs as
-- a definer while restricting results to the authenticated user's own id/phone.
-- The phone fallback also uses auth.users.phone when the customer profile is not
-- populated yet. No status filter means cancelled orders remain visible.
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
      or regexp_replace(coalesce(o.customer_phone,''), '[^0-9]', '', 'g') = regexp_replace(coalesce((select coalesce(cp.phone, u.phone) from auth.users u left join public.customer_profiles cp on cp.id = u.id where u.id = auth.uid() limit 1),''), '[^0-9]', '', 'g')
      or regexp_replace(regexp_replace(coalesce(o.customer_phone,''), '[^0-9]', '', 'g'), '^88', '') = regexp_replace(regexp_replace(coalesce((select coalesce(cp.phone, u.phone) from auth.users u left join public.customer_profiles cp on cp.id = u.id where u.id = auth.uid() limit 1),''), '[^0-9]', '', 'g'), '^88', '')
    )
  order by o.created_at desc;
$$;

revoke all on function public.get_my_customer_orders() from public;
grant execute on function public.get_my_customer_orders() to authenticated;
