-- Reduce admin Data API latency after the Supabase migration.
-- Security-definer permission checks depend only on the current user, so wrapping
-- them in SELECT lets Postgres evaluate them once per statement (InitPlan)
-- instead of once per scanned row.

ALTER POLICY orders_staff_read ON public.orders
USING (
  (SELECT public.is_admin((SELECT auth.uid())))
  OR status::text <> 'web_pending'::text
  OR assigned_to = (SELECT auth.uid())
);

ALTER POLICY orders_admin_delete ON public.orders
USING ((SELECT public.is_admin((SELECT auth.uid()))));

ALTER POLICY orders_staff_update ON public.orders
USING ((SELECT public.has_permission((SELECT auth.uid()), 'orders')))
WITH CHECK ((SELECT public.has_permission((SELECT auth.uid()), 'orders')));

ALTER POLICY deleted_orders_staff_read ON public.deleted_orders
USING ((SELECT public.has_permission((SELECT auth.uid()), 'orders')));

ALTER POLICY staff_can_read_action_events ON public.order_action_events
USING (
  (SELECT public.is_admin((SELECT auth.uid())))
  OR (SELECT public.has_permission((SELECT auth.uid()), 'orders'))
);

ALTER POLICY order_items_read ON public.order_items
USING (
  (SELECT public.has_permission((SELECT auth.uid()), 'orders'))
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.created_by = (SELECT auth.uid())
  )
);

ALTER POLICY order_items_staff_write ON public.order_items
USING ((SELECT public.has_permission((SELECT auth.uid()), 'orders')))
WITH CHECK ((SELECT public.has_permission((SELECT auth.uid()), 'orders')));

ALTER POLICY site_visitors_dashboard_read ON public.site_visitors
USING ((SELECT public.has_permission((SELECT auth.uid()), 'dashboard')));

CREATE INDEX IF NOT EXISTS idx_deleted_orders_original_created_at
  ON public.deleted_orders (original_created_at DESC);
