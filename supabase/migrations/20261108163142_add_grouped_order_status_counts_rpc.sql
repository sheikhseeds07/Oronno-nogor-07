create or replace function public.get_order_status_counts(
  p_statuses text[] default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with wanted as (
    select distinct unnest(
      case
        when p_statuses is null or cardinality(p_statuses) = 0 then
          array['web_pending','pending','rts','shipped','delivered','pending_return','returned','partial','cancelled','hold']::text[]
        else p_statuses
      end
    ) as status
  ),
  counts as (
    select o.status::text as status, count(*)::bigint as total
    from public.orders o
    where o.status::text in (select status from wanted)
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at <= p_to)
    group by o.status
  )
  select coalesce(
    jsonb_object_agg(w.status, coalesce(c.total, 0)),
    '{}'::jsonb
  )
  from wanted w
  left join counts c using (status);
$function$;

revoke all on function public.get_order_status_counts(text[], timestamptz, timestamptz) from public;
grant execute on function public.get_order_status_counts(text[], timestamptz, timestamptz) to authenticated, service_role;
