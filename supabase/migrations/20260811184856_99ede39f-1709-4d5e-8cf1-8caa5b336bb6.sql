CREATE POLICY "media_public_read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id IN ('product-images','banners','category-images'));

CREATE POLICY "media_staff_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images','banners','category-images') AND public.is_staff(auth.uid()));

CREATE POLICY "media_staff_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images','banners','category-images') AND public.is_staff(auth.uid()))
WITH CHECK (bucket_id IN ('product-images','banners','category-images') AND public.is_staff(auth.uid()));

CREATE POLICY "media_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('product-images','banners','category-images') AND public.is_admin(auth.uid()));