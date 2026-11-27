-- Fix the one unqualified enum cast before removing public from the trigger search path.
CREATE OR REPLACE FUNCTION public.mark_converted_order_as_incomplete_origin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.event = 'converted' THEN
    UPDATE public.orders o
       SET originated_from_incomplete = true,
           source = 'incomplete'::public.order_source
     WHERE o.id = (
       SELECT o2.id
       FROM public.orders o2
       WHERE regexp_replace(coalesce(o2.customer_phone, ''), '\\D', '', 'g') =
             regexp_replace(coalesce(NEW.phone, ''), '\\D', '', 'g')
         AND o2.status = 'web_pending'::public.order_status
         AND coalesce(o2.originated_from_incomplete, false) = false
         AND o2.created_at >= NEW.created_at - interval '2 minutes'
         AND o2.created_at <= NEW.created_at + interval '2 minutes'
       ORDER BY abs(extract(epoch FROM (o2.created_at - NEW.created_at))) ASC
       LIMIT 1
     );
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.mark_order_incomplete_from_conversion_event() SET search_path = pg_catalog;
ALTER FUNCTION public.normalize_bd_phone(text) SET search_path = pg_catalog;
ALTER FUNCTION public.preserve_incomplete_order_origin() SET search_path = pg_catalog;
ALTER FUNCTION public.set_order_cancelled_by_auth() SET search_path = pg_catalog;
ALTER FUNCTION public.touch_incomplete_orders_updated_at() SET search_path = pg_catalog;
