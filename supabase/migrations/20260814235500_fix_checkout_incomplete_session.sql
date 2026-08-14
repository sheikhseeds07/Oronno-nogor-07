-- Keep one incomplete order per stable checkout/session instead of per phone.
-- Existing rows are preserved; legacy rows keep checkout_session_id = NULL.
ALTER TABLE public.incomplete_orders
  ADD COLUMN IF NOT EXISTS checkout_session_id UUID;

-- Phone can legitimately change during the same checkout and can also be reused
-- by separate checkout sessions, so it must not be the dedupe key.
ALTER TABLE public.incomplete_orders
  DROP CONSTRAINT IF EXISTS incomplete_orders_phone_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.incomplete_orders'::regclass
      AND conname = 'incomplete_orders_checkout_session_id_key'
  ) THEN
    ALTER TABLE public.incomplete_orders
      ADD CONSTRAINT incomplete_orders_checkout_session_id_key UNIQUE (checkout_session_id);
  END IF;
END $$;

-- Keep phone lookup fast for admin/customer lookup use cases.
CREATE INDEX IF NOT EXISTS idx_incomplete_orders_phone
  ON public.incomplete_orders (phone);
