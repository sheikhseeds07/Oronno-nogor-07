-- Employee order visibility:
-- Processing (web_pending) remains distributed/visible only to its assignee.
-- All other order-list statuses remain visible to every employee with order access.

DROP POLICY IF EXISTS orders_staff_read ON public.orders;
CREATE POLICY orders_staff_read
ON public.orders
FOR SELECT TO authenticated
USING (
  is_admin(auth.uid())
  OR status::text <> 'web_pending'
  OR assigned_to = auth.uid()
);
