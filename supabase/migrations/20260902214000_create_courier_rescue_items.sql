CREATE TABLE IF NOT EXISTS public.courier_rescue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  issue_type text NOT NULL DEFAULT 'problem',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved','cancelled')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, issue_type)
);
CREATE INDEX IF NOT EXISTS courier_rescue_items_status_idx ON public.courier_rescue_items(status, updated_at DESC);
ALTER TABLE public.courier_rescue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_rescue_admin_all" ON public.courier_rescue_items FOR ALL TO authenticated USING (has_role((select auth.uid()), 'admin'::public.app_role) OR has_role((select auth.uid()), 'super_admin'::public.app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::public.app_role) OR has_role((select auth.uid()), 'super_admin'::public.app_role));
CREATE POLICY "courier_rescue_employee_select" ON public.courier_rescue_items FOR SELECT TO authenticated USING (has_permission((select auth.uid()), 'courier_notes'::text));
CREATE POLICY "courier_rescue_employee_update" ON public.courier_rescue_items FOR UPDATE TO authenticated USING (has_permission((select auth.uid()), 'courier_notes'::text)) WITH CHECK (has_permission((select auth.uid()), 'courier_notes'::text));
