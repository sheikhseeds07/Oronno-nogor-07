-- Keep anonymous storefront reads independent of the staff-only helper.
-- The previous combined policies invoked is_staff() for anon requests, but
-- is_staff() is intentionally not executable by anon. Split anon and
-- authenticated visibility while preserving the same row visibility rules.

drop policy if exists banners_public_read on public.banners;
create policy banners_public_read_anon
  on public.banners for select to anon
  using (is_active = true);
create policy banners_public_read_authenticated
  on public.banners for select to authenticated
  using (is_active = true or public.is_staff((select auth.uid())));

drop policy if exists landing_public_read on public.landing_pages;
create policy landing_public_read_anon
  on public.landing_pages for select to anon
  using (is_published = true);
create policy landing_public_read_authenticated
  on public.landing_pages for select to authenticated
  using (is_published = true or public.is_staff((select auth.uid())));

drop policy if exists products_public_read on public.products;
create policy products_public_read_anon
  on public.products for select to anon
  using (is_active = true);
create policy products_public_read_authenticated
  on public.products for select to authenticated
  using (is_active = true or public.is_staff((select auth.uid())));

drop policy if exists offer_items_public_read on public.offer_items;
create policy offer_items_public_read_anon
  on public.offer_items for select to anon
  using (
    exists (
      select 1 from public.products p
      where p.id = offer_items.offer_product_id
        and p.is_offer = true
        and p.is_active = true
        and p.is_archived = false
    )
  );
create policy offer_items_public_read_authenticated
  on public.offer_items for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = offer_items.offer_product_id
        and p.is_offer = true
        and p.is_active = true
        and p.is_archived = false
    )
    or public.is_staff((select auth.uid()))
  );