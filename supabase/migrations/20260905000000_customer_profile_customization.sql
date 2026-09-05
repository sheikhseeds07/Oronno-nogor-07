-- Customer profile customization only. Does not alter order/auth/business logic.
alter table public.customer_profiles
  add column if not exists cover_url text,
  add column if not exists bio text;

-- Public profile media bucket. Files are isolated by authenticated user id in the path.
insert into storage.buckets (id, name, public)
values ('customer-profiles', 'customer-profiles', true)
on conflict (id) do update set public = true;

-- Users can manage only their own profile media: <user-id>/...
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
