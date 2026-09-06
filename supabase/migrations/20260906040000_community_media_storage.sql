-- Dedicated public bucket for community posts and 24h stories.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', true, 26214400, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','video/x-m4v'])
on conflict (id) do update set public = true, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;

create policy "community media public read"
on storage.objects for select to public
using (bucket_id = 'community-media');

create policy "community media auth upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community media own update"
on storage.objects for update to authenticated
using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "community media own delete"
on storage.objects for delete to authenticated
using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
