-- Improves the Admin order search OR filter, which includes
-- courier_consignment ILIKE '%term%'. The existing B-tree index supports
-- exact/prefix lookups but not contains searches.
-- Apply only after staging validation and an approved production window.
CREATE INDEX IF NOT EXISTS idx_orders_courier_consignment_trgm
  ON public.orders USING gin (courier_consignment gin_trgm_ops)
  WHERE courier_consignment IS NOT NULL;
