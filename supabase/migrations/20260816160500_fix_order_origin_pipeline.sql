-- Canonical order-origin pipeline:
-- 1) Customer checkout => source=web, status=web_pending.
-- 2) Staff opens a Web Order and creates it => source stays web, status=pending (approval).
-- 3) Staff cancels a Web Order => status=cancelled.
-- 4) An Incomplete checkout converted by staff => source=incomplete, status=pending.
--    It must never become web_pending.

CREATE OR REPLACE FUNCTION public.mark_incomplete_conversion_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  matched_incomplete uuid;
begin
  -- Public/customer checkout is authoritative: never let a session user id
  -- or legacy source value turn it into an Incomplete order.
  IF NEW.created_by IS NULL AND lower(coalesce(NEW.source::text, '')) IN ('web', 'manual', 'incomplete') THEN
    NEW.source := 'web';
    IF NEW.status IN ('pending', 'web_pending') THEN
      NEW.status := 'web_pending';
    END IF;
    NEW.originated_from_incomplete := false;
    RETURN NEW;
  END IF;

  -- Staff-created Pending order: if it corresponds to a recent Incomplete
  -- checkout, preserve that origin and put it directly into the normal
  -- Pending/approval list. Otherwise it is a normal manual order.
  IF NEW.created_by IS NOT NULL AND NEW.status = 'pending' THEN
    select id into matched_incomplete
    from public.incomplete_orders
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(new.customer_phone, '\D', '', 'g')
      and created_at >= now() - interval '48 hours'
    order by updated_at desc
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

-- Repair conversions produced by the previous trigger version.
UPDATE public.orders
SET source = 'incomplete',
    status = 'pending',
    originated_from_incomplete = true
WHERE source::text = 'incomplete'
  AND status = 'web_pending';

-- Keep the customer checkout classification deterministic for today's web
-- orders that may have been created with a browser session id.
UPDATE public.orders
SET source = 'web',
    originated_from_incomplete = false,
    status = CASE WHEN status = 'incomplete' THEN 'web_pending' ELSE status END,
    created_by = NULL
WHERE source::text = 'web'
  AND created_at::date = current_date;
