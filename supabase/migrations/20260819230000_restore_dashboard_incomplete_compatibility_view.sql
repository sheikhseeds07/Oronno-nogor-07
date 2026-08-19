-- Dashboard compatibility: the incomplete-order system was retired, but the
-- dashboard function still reads the relation to calculate the legacy active
-- incomplete count. Keep an empty compatibility view so that query does not
-- abort the entire dashboard report.
CREATE OR REPLACE VIEW public.incomplete_orders AS
SELECT
  o.id,
  o.updated_at
FROM public.orders AS o
WHERE false;
