-- Order Division hardening:
-- 1) Admins can see every order; non-admin staff can only see orders assigned to them.
-- 2) Processing orders (web_pending/pending) are auto-assigned only when unassigned.
-- 3) Existing Processing orders are redistributed in created_at order.

DROP POLICY IF EXISTS orders_staff_read ON public.orders;
CREATE POLICY orders_staff_read
ON public.orders
FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR assigned_to = auth.uid());

CREATE OR REPLACE FUNCTION public.auto_assign_processing_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_include boolean;
BEGIN
  SELECT
    COALESCE((settings->>'order_distribution_enabled')::boolean, false),
    COALESCE((settings->>'order_distribution_include_incomplete')::boolean, true)
  INTO v_enabled, v_include
  FROM public.site_settings
  LIMIT 1;

  IF NOT v_enabled OR NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status::text IN ('web_pending', 'pending') THEN
    IF COALESCE(NEW.originated_from_incomplete, false) AND NOT v_include THEN
      RETURN NEW;
    END IF;
    PERFORM public.assign_order_round_robin(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_processing_order ON public.orders;
CREATE TRIGGER trg_auto_assign_processing_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
WHEN ((NEW.status)::text = ANY (ARRAY['web_pending'::text, 'pending'::text]))
EXECUTE FUNCTION public.auto_assign_processing_order();

-- Rebalance all currently active Processing orders safely and deterministically.
UPDATE public.orders
SET assigned_to = NULL
WHERE status::text IN ('web_pending', 'pending');

UPDATE public.order_distribution_state
SET next_position = 0, updated_at = now()
WHERE id = true;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.orders
    WHERE status::text IN ('web_pending', 'pending')
    ORDER BY created_at ASC, id ASC
  LOOP
    PERFORM public.assign_order_round_robin(r.id);
  END LOOP;
END;
$$;
