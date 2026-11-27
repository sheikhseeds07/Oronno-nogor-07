-- Application roles need to use public objects, but must never create/shadow them.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- New functions created by the migration owner must not inherit PUBLIC EXECUTE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Guard privileged dashboard RPCs at the database boundary.
CREATE OR REPLACE FUNCTION public.dashboard_confirmed_order_count(
  p_from timestamp with time zone,
  p_to timestamp with time zone
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_count bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  WITH active_orders AS (
    SELECT id
    FROM public.orders
    WHERE lower(coalesce(source::text, '')) = 'web'
      AND created_at >= p_from AND created_at <= p_to
      AND lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')
  ),
  deleted AS (
    SELECT id
    FROM public.deleted_orders
    WHERE lower(coalesce(order_data->>'source', '')) = 'web'
      AND original_created_at >= p_from AND original_created_at <= p_to
      AND lower(coalesce(original_status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')
  )
  SELECT count(*)::bigint
    INTO v_count
  FROM (
    SELECT id FROM active_orders
    UNION
    SELECT id FROM deleted
    WHERE NOT EXISTS (SELECT 1 FROM active_orders a WHERE a.id = deleted.id)
  ) x;

  RETURN coalesce(v_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_egress_summary(
  p_from timestamp with time zone,
  p_to timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  WITH o AS (
    SELECT id, source::text source, status::text status, total, created_at, created_by, assigned_to, confirmed_at, confirmed_by,
           coalesce(originated_from_import, false) originated_from_import
    FROM public.orders WHERE created_at BETWEEN p_from AND p_to
  ),
  d AS (
    SELECT id, (order_data->>'source')::text source, original_status::text status, total, original_created_at created_at,
           NULL::uuid created_by, NULL::uuid assigned_to,
           nullif(order_data->>'confirmed_at', '')::timestamptz confirmed_at,
           nullif(order_data->>'confirmed_by', '')::uuid confirmed_by,
           coalesce((order_data->>'originated_from_import')::boolean, false) originated_from_import
    FROM public.deleted_orders WHERE original_created_at BETWEEN p_from AND p_to
  ),
  a AS (
    SELECT * FROM o
    UNION ALL
    SELECT d.* FROM d WHERE NOT EXISTS (SELECT 1 FROM o WHERE o.id = d.id)
  ),
  r AS (SELECT * FROM a WHERE lower(coalesce(source::text, '')) <> 'incomplete'),
  w AS (SELECT * FROM r WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false),
  i AS (SELECT * FROM a WHERE lower(coalesce(source::text, '')) = 'incomplete'),
  c AS (SELECT * FROM r WHERE lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')),
  p AS (SELECT o.* FROM public.orders o WHERE o.status = 'web_pending'::public.order_status),
  x AS (SELECT * FROM w WHERE lower(coalesce(status::text, '')) IN ('cancelled','canceled')),
  ic AS (
    SELECT coalesce(sum(oi.quantity * coalesce(pr.cost, 0)), 0) v
    FROM public.order_items oi
    JOIN c ON c.id = oi.order_id
    LEFT JOIN public.products pr ON pr.id = oi.product_id
  ),
  confirmed_events AS (
    SELECT DISTINCT ae.order_id
    FROM public.order_action_events ae
    WHERE ae.action = 'confirm' AND ae.created_at BETWEEN p_from AND p_to
  ),
  b AS (
    SELECT (array_agg(oi.product_id) FILTER (WHERE oi.product_id IS NOT NULL))[1] product_id,
           max(oi.product_name) product_name, sum(oi.quantity) units, sum(oi.subtotal) revenue
    FROM public.order_items oi
    JOIN confirmed_events ce ON ce.order_id = oi.order_id
    GROUP BY oi.product_name
    ORDER BY units DESC, revenue DESC, product_name
  ),
  s AS (
    SELECT coalesce(source::text, 'unknown') source, count(*) count, coalesce(sum(total), 0) revenue
    FROM a GROUP BY 1 ORDER BY count DESC
  ),
  dy AS (
    SELECT to_char(created_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') day_key,
      count(*) FILTER (WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false) created,
      count(*) FILTER (WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false AND lower(coalesce(status::text, '')) IN ('web_pending','processing')) processing,
      count(*) FILTER (WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false AND lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')) confirmed,
      count(*) FILTER (WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false AND lower(coalesce(status::text, '')) IN ('cancelled','canceled')) cancelled
    FROM a GROUP BY 1 ORDER BY 1
  ),
  hr AS (
    SELECT extract(hour FROM created_at AT TIME ZONE 'Asia/Dhaka')::int hour_key,
      count(*) FILTER (WHERE lower(coalesce(source::text, '')) = 'web' AND originated_from_import = false) orders
    FROM a GROUP BY 1
  ),
  ev AS (
    SELECT ae.order_id, ae.actor_id, ae.action, ae.created_at
    FROM public.order_action_events ae WHERE ae.created_at BETWEEN p_from AND p_to
  ),
  ep AS (
    SELECT e.user_id, e.name,
      count(*) FILTER (WHERE ev.action = 'confirm') confirmed,
      count(*) FILTER (WHERE ev.action = 'cancel') cancelled,
      count(*) FILTER (WHERE ev.action IN ('confirm','cancel')) total
    FROM public.employees e
    LEFT JOIN ev ON ev.actor_id = e.user_id
    WHERE e.is_active = true
    GROUP BY e.user_id, e.name
    ORDER BY confirmed DESC
  )
  SELECT jsonb_build_object(
    'real', jsonb_build_object(
      'created', (SELECT count(*) FROM public.dashboard_web_order_history h WHERE h.first_counted_at BETWEEN p_from AND p_to),
      'total', (SELECT count(*) FROM public.dashboard_web_order_history h WHERE h.first_counted_at BETWEEN p_from AND p_to),
      'processing', (SELECT count(*) FROM p),
      'approved', (SELECT count(*) FROM w WHERE lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')),
      'pending', (SELECT count(*) FROM p),
      'cancelled', (SELECT count(*) FROM x),
      'revenue', (SELECT coalesce(sum(total), 0) FROM c),
      'allRevenue', (SELECT coalesce(sum(total), 0) FROM w)
    ),
    'webOrders', jsonb_build_object(
      'total', (SELECT count(*) FROM public.dashboard_web_order_history h WHERE h.first_counted_at BETWEEN p_from AND p_to),
      'confirmed', (SELECT count(*) FROM w WHERE lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')),
      'processing', (SELECT count(*) FROM p),
      'cancelled', (SELECT count(*) FROM x)
    ),
    'incompleteOrders', jsonb_build_object(
      'total', (SELECT count(*) FROM i),
      'confirmed', (SELECT count(*) FROM i WHERE lower(coalesce(status::text, '')) IN ('pending','rts','shipped','delivered','pending_return','returned','partial')),
      'processing', (SELECT count(*) FROM i WHERE lower(coalesce(status::text, '')) IN ('web_pending','processing')),
      'cancelled', (SELECT count(*) FROM i WHERE lower(coalesce(status::text, '')) IN ('cancelled','canceled')),
      'active', (SELECT count(*) FROM i WHERE lower(coalesce(status::text, '')) NOT IN ('cancelled','canceled'))
    ),
    'profit', jsonb_build_object('grossSales', (SELECT coalesce(sum(total), 0) FROM c), 'productCost', (SELECT v FROM ic)),
    'sourceBreakdown', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM s), '[]'::jsonb),
    'daily', coalesce((SELECT jsonb_agg(to_jsonb(dy)) FROM dy), '[]'::jsonb),
    'hourly', coalesce((SELECT jsonb_agg(jsonb_build_object('hour', hour_key, 'orders', orders)) FROM hr), '[]'::jsonb),
    'employeePerformance', coalesce((SELECT jsonb_agg(to_jsonb(ep)) FROM ep), '[]'::jsonb),
    'bestSelling', coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM b), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_order(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.deleted_orders WHERE id = p_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.permanently_delete_archived_orders(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.deleted_orders WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

-- Remove inherited PUBLIC EXECUTE from all currently PUBLIC-executable SECURITY DEFINER functions.
DO $revoke_public$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND EXISTS (
        SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.oid::regprocedure);
  END LOOP;
END;
$revoke_public$;

-- Functions used by authenticated customers or staff only.
REVOKE ALL ON FUNCTION public.archive_orders(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_orders(uuid[], uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_orders(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_orders(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_customer_order_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_order_history(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_customer_order_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_customer_order_detail(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_customer_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_customer_orders() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_employees_full() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_employees_full() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.permanently_delete_archived_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_order(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.permanently_delete_archived_orders(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_orders(uuid[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.register_customer_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_customer_device(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.restore_deleted_order(uuid, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_order(uuid, public.order_status) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.restore_deleted_orders(uuid[], public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_orders(uuid[], public.order_status) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.staff_customer_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_customer_history(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_confirmed_order_count(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_confirmed_order_count(timestamptz, timestamptz) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dashboard_egress_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_egress_summary(timestamptz, timestamptz) TO authenticated, service_role;

-- Customer-block management RPCs are authenticated and enforce staff/admin checks in their bodies.
REVOKE ALL ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_blocked(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_set_customer_blocked(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_blocked(uuid, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_set_customer_blocked_v2(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_customer_blocked_v2(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.block_customer(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_customer(text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_manage_customer_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_customer_blocks() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_customer_block(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_block(text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_customer_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_blocks() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_customer_blocks_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_blocks_v2() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.unblock_customer(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_customer(uuid, boolean, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.unblock_customer_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_customer_v2(uuid) TO authenticated, service_role;

-- Public checkout/visitor endpoints: remove PUBLIC inheritance, then grant only intended API roles.
REVOKE ALL ON FUNCTION public.get_meta_capi_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meta_capi_status() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_public_order_confirmation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_confirmation(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_blocked_visitor(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_visitor(text, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.heartbeat_site_visitor(uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_site_visitor(uuid, text, uuid, uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.place_public_order(text, text, text, numeric, jsonb, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_public_order(text, text, text, numeric, jsonb, text, text, text, text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_incomplete_checkout(text, text, text, text, text, numeric, numeric, numeric, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_incomplete_checkout(text, text, text, text, text, numeric, numeric, numeric, text, jsonb) TO anon, authenticated, service_role;

-- Landing checkout overloads: keep anonymous checkout working and explicitly support signed-in customers too.
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid, text, text, text, numeric, jsonb, jsonb, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid, text, text, text, numeric, jsonb, jsonb, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid, text, text, text, numeric, jsonb, jsonb, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_landing_checkout_intent(uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_landing_intent_tracking(uuid, text, text, text, text) TO anon, authenticated, service_role;

-- These helpers are only called inside SECURITY DEFINER checkout logic or by trusted server jobs.
REVOKE ALL ON FUNCTION public.check_and_touch_order_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_touch_order_rate_limit(text, text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.check_and_touch_order_rate_limit_device(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_touch_order_rate_limit_device(text, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.is_customer_blocked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_customer_blocked(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.is_site_blocked(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_blocked(text, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.phone_repeat_wait_minutes(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phone_repeat_wait_minutes(text) TO service_role;
REVOKE ALL ON FUNCTION public.record_web_order_confirmation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_web_order_confirmation(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.refresh_top_selling_products() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_top_selling_products() TO service_role;
REVOKE ALL ON FUNCTION public.dashboard_egress_summary_legacy(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_egress_summary_legacy(timestamptz, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.get_r2_storage_manifest(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_r2_storage_manifest(text, integer, integer) TO service_role;

-- Trigger/Cron/event-trigger internals are not RPC endpoints.
REVOKE ALL ON FUNCTION public.apply_incomplete_conversion_event_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_invoice_no() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_order_round_robin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_processing_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_incomplete_for_active_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_dashboard_web_order_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_expired_landing_checkout_intents() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_order_from_incomplete_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_incomplete_order_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_visitor_telemetry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_order_action_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_order_action_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_order_cancellation_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_incomplete_for_active_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_created_by_from_auth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_order_shipped_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_courier_edge_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_courier_edge_slot(integer) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_courier_provider_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_courier_provider_slot(integer) TO service_role;
