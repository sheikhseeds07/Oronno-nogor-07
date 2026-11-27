CREATE OR REPLACE FUNCTION public.get_order_status_counts(
  p_statuses text[] DEFAULT NULL::text[],
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  WITH wanted AS (
    SELECT DISTINCT unnest(
      CASE
        WHEN p_statuses IS NULL OR cardinality(p_statuses) = 0 THEN
          ARRAY['web_pending','pending','rts','shipped','delivered','pending_return','returned','partial','cancelled','hold']::text[]
        ELSE p_statuses
      END
    ) AS status
  ),
  valid_wanted AS (
    SELECT e.enumlabel::public.order_status AS status
    FROM pg_catalog.pg_enum e
    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'order_status'
      AND e.enumlabel IN (SELECT status FROM wanted)
  ),
  counts AS (
    SELECT o.status::text AS status, count(*)::bigint AS total
    FROM public.orders o
    WHERE o.status IN (SELECT status FROM valid_wanted)
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to IS NULL OR o.created_at <= p_to)
    GROUP BY o.status
  )
  SELECT coalesce(
    jsonb_object_agg(w.status, coalesce(c.total, 0)),
    '{}'::jsonb
  )
  FROM wanted w
  LEFT JOIN counts c USING (status);
$function$;

REVOKE ALL ON FUNCTION public.get_order_status_counts(text[], timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_status_counts(text[], timestamptz, timestamptz) TO authenticated, service_role;
