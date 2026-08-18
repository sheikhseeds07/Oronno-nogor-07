-- Keep cancellation statistics independent from whether the cancelled order is later deleted.
-- This is intentionally append-only: deleting an order must never erase its cancellation history.

CREATE TABLE IF NOT EXISTS public.order_cancellation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text,
  source text NOT NULL DEFAULT 'web',
  cancelled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellation_history_cancelled_at
  ON public.order_cancellation_history(cancelled_at);
CREATE INDEX IF NOT EXISTS idx_order_cancellation_history_source_cancelled_at
  ON public.order_cancellation_history(source, cancelled_at);

ALTER TABLE public.order_cancellation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can read cancellation history" ON public.order_cancellation_history;
CREATE POLICY "staff can read cancellation history"
ON public.order_cancellation_history
FOR SELECT
TO authenticated
USING (true);

-- Web/normal orders: record the transition to cancelled before the row can be deleted.
CREATE OR REPLACE FUNCTION public.record_order_cancellation_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'cancelled' AND OLD.status::text IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.order_cancellation_history(order_id, source, cancelled_at)
    VALUES (OLD.id::text, COALESCE(OLD.source::text, 'web'), COALESCE(OLD.updated_at, now()));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_order_cancellation_history ON public.orders;
CREATE TRIGGER trg_record_order_cancellation_history
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.record_order_cancellation_history();

-- If the legacy incomplete_orders table still exists in an environment, record
-- its cancellation before deletion as well. The block is safe when the table
-- has already been retired.
DO $$
BEGIN
  IF to_regclass('public.incomplete_orders') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.record_incomplete_cancellation_history()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        INSERT INTO public.order_cancellation_history(order_id, source, cancelled_at)
        VALUES (OLD.id::text, 'incomplete', now());
        RETURN OLD;
      END;
      $body$;
    $fn$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_record_incomplete_cancellation_history ON public.incomplete_orders';
    EXECUTE 'CREATE TRIGGER trg_record_incomplete_cancellation_history BEFORE DELETE ON public.incomplete_orders FOR EACH ROW EXECUTE FUNCTION public.record_incomplete_cancellation_history()';
  END IF;
END $$;
