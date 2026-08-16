-- Public/customer checkout orders must never be classified as Incomplete.
-- Staff-created orders keep the existing incomplete-promotion workflow.

CREATE OR REPLACE FUNCTION public.mark_incomplete_conversion_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  matched_incomplete uuid;
  public_order boolean;
begin
  public_order := NEW.created_by IS NULL;

  IF public_order AND lower(coalesce(NEW.source::text, '')) IN ('manual', 'incomplete') THEN
    NEW.source := 'web';
    IF NEW.status IN ('pending', 'web_pending') THEN
      NEW.status := 'web_pending';
    END IF;
    NEW.originated_from_incomplete := false;
    RETURN NEW;
  END IF;

  IF NEW.source = 'manual' AND NEW.status = 'pending' AND NEW.created_by IS NOT NULL THEN
    select id into matched_incomplete
    from public.incomplete_orders
    where regexp_replace(phone, '\D', '', 'g') = regexp_replace(new.customer_phone, '\D', '', 'g')
      and created_at >= now() - interval '48 hours'
    order by updated_at desc
    limit 1;

    if matched_incomplete is not null then
      new.source := 'incomplete';
      new.status := 'web_pending';
      new.originated_from_incomplete := true;
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_mark_incomplete_conversion_order ON public.orders;
CREATE TRIGGER trg_mark_incomplete_conversion_order
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_incomplete_conversion_order();

-- Repair today's anonymous orders that were incorrectly stored as Incomplete.
UPDATE public.orders
SET source = 'web', originated_from_incomplete = false
WHERE created_at::date = current_date
  AND created_by IS NULL
  AND source::text = 'incomplete';
