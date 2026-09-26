-- Admin/product relation performance.
-- Supports offer_items lookups and joins by product_id without touching NULL rows.
create index if not exists idx_offer_items_product_id
  on public.offer_items(product_id)
  where product_id is not null;
