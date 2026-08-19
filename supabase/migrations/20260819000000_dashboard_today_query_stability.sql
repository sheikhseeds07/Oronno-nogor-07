-- Dashboard stability: keep today's order-item lookups fast and preserve
-- compatibility with the retired incomplete_orders query used by the dashboard.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_dashboard
  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_dashboard
  ON public.orders(created_at);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_status_dashboard
  ON public.orders(created_at, status);

-- The incomplete-order system was retired, but older dashboard code still
-- reads this relation. Provide a zero-row compatibility view instead of
-- allowing the entire dashboard report to fail.
CREATE OR REPLACE VIEW public.incomplete_orders AS
SELECT
  o.id,
  o.updated_at
FROM public.orders o
WHERE false;
