-- Restore authenticated order-lock writes for staff who already have order permission.
-- Keep row-level security enabled and restrict writes to the current user's lock
-- (admins may update an existing lock when taking over).
GRANT INSERT, UPDATE ON TABLE public.order_locks TO authenticated;

DROP POLICY IF EXISTS order_locks_staff_insert ON public.order_locks;
CREATE POLICY order_locks_staff_insert
  ON public.order_locks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission((SELECT auth.uid()), 'orders')
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS order_locks_staff_update ON public.order_locks;
CREATE POLICY order_locks_staff_update
  ON public.order_locks
  FOR UPDATE
  TO authenticated
  USING (
    has_permission((SELECT auth.uid()), 'orders')
    AND (
      user_id = (SELECT auth.uid())
      OR is_admin((SELECT auth.uid()))
    )
  )
  WITH CHECK (
    has_permission((SELECT auth.uid()), 'orders')
    AND (
      user_id = (SELECT auth.uid())
      OR is_admin((SELECT auth.uid()))
    )
  );
