-- Incomplete orders are retired. Public checkout now creates Web Pending directly.
-- Existing orders are preserved and normalized as normal Web orders.
UPDATE public.orders
SET source = 'web',
    originated_from_incomplete = false,
    status = CASE WHEN status::text = 'incomplete' THEN 'web_pending'::order_status ELSE status END
WHERE source::text = 'incomplete'
   OR originated_from_incomplete = true
   OR status::text = 'incomplete';

DROP TRIGGER IF EXISTS trg_mark_incomplete_conversion_order ON public.orders;
DROP FUNCTION IF EXISTS public.mark_incomplete_conversion_order();
DROP TABLE IF EXISTS public.incomplete_events CASCADE;
DROP TABLE IF EXISTS public.incomplete_orders CASCADE;
