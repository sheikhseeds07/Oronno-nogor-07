insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do update set public = true;

create policy "review images public read"
on storage.objects for select to public
using (bucket_id = 'review-images');

create policy "review images auth upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "review images own update"
on storage.objects for update to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "review images own delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);