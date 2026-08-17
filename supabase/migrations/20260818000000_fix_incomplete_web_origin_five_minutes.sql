-- Order-origin rules:
-- 1) A public checkout that reaches web_pending is a Web Order.
-- 2) A staff-created Pending order from the Incomplete tab is an Incomplete-origin order,
--    not a Web Order.
-- 3) The Incomplete -> staff-created conversion match is limited to 5 minutes,
--    so an old abandoned checkout can never make a later manual order look like
--    an Incomplete conversion.

CREATE OR REPLACE FUNCTION public.mark_incomplete_conversion_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  matched_incomplete uuid;
begin
  -- Public/customer checkout is authoritative. A checkout submitted by the
  -- customer is a Web Order and starts in Web Pending.
  IF NEW.created_by IS NULL AND lower(coalesce(NEW.source::text, '')) IN ('web', 'manual', 'incomplete') THEN
    NEW.source := 'web';
    IF NEW.status IN ('pending', 'web_pending') THEN
      NEW.status := 'web_pending';
    END IF;
    NEW.originated_from_incomplete := false;
    RETURN NEW;
  END IF;

  -- Staff-created Pending order: only treat it as an Incomplete conversion
  -- when the matching incomplete checkout was created/updated within 5 minutes.
  IF NEW.created_by IS NOT NULL AND NEW.status = 'pending' THEN
    select id into matched_incomplete
    from public.incomplete_orders
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(new.customer_phone, '\D', '', 'g')
      and coalesce(updated_at, created_at) >= now() - interval '5 minutes'
    order by coalesce(updated_at, created_at) desc
    limit 1;

    IF matched_incomplete IS NOT NULL THEN
      NEW.source := 'incomplete';
      NEW.status := 'pending';
      NEW.originated_from_incomplete := true;
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_mark_incomplete_conversion_order ON public.orders;
CREATE TRIGGER trg_mark_incomplete_conversion_order
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_incomplete_conversion_order();
