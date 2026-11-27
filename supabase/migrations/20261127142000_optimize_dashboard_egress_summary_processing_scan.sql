CREATE OR REPLACE FUNCTION public.dashboard_egress_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with o as (
  select id,source::text source,status::text status,total,created_at,created_by,assigned_to,confirmed_at,confirmed_by,
         coalesce(originated_from_import,false) originated_from_import
  from public.orders where created_at between p_from and p_to
),
d as (
  select id,(order_data->>'source')::text source,original_status::text status,total,original_created_at created_at,
         null::uuid created_by,null::uuid assigned_to,
         nullif(order_data->>'confirmed_at','')::timestamptz confirmed_at,
         nullif(order_data->>'confirmed_by','')::uuid confirmed_by,
         coalesce((order_data->>'originated_from_import')::boolean,false) originated_from_import
  from public.deleted_orders where original_created_at between p_from and p_to
),
a as (
  select * from o
  union all
  select d.* from d where not exists(select 1 from o where o.id=d.id)
),
r as (select * from a where lower(coalesce(source::text,''))<>'incomplete'),
w as (select * from r where lower(coalesce(source::text,''))='web' and originated_from_import=false),
i as (select * from a where lower(coalesce(source::text,''))='incomplete'),
c as (select * from r where lower(coalesce(status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),
p as (
  select o.*
  from public.orders o
  where o.status = 'web_pending'::public.order_status
),
x as (select * from w where lower(coalesce(status::text,'')) in ('cancelled','canceled')),
ic as (select coalesce(sum(oi.quantity*coalesce(pr.cost,0)),0) v from public.order_items oi join c on c.id=oi.order_id left join public.products pr on pr.id=oi.product_id),
confirmed_events as (select distinct ae.order_id from public.order_action_events ae where ae.action='confirm' and ae.created_at between p_from and p_to),
b as (select (array_agg(oi.product_id) filter(where oi.product_id is not null))[1] product_id,max(oi.product_name) product_name,sum(oi.quantity) units,sum(oi.subtotal) revenue from public.order_items oi join confirmed_events ce on ce.order_id=oi.order_id group by oi.product_name order by units desc,revenue desc,product_name),
s as (select coalesce(source::text,'unknown') source,count(*) count,coalesce(sum(total),0) revenue from a group by 1 order by count desc),
dy as (select to_char(created_at at time zone 'Asia/Dhaka','YYYY-MM-DD') day_key,
  count(*) filter(where lower(coalesce(source::text,''))='web' and originated_from_import=false) created,
  count(*) filter(where lower(coalesce(source::text,''))='web' and originated_from_import=false and lower(coalesce(status::text,'')) in ('web_pending','processing')) processing,
  count(*) filter(where lower(coalesce(source::text,''))='web' and originated_from_import=false and lower(coalesce(status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')) confirmed,
  count(*) filter(where lower(coalesce(source::text,''))='web' and originated_from_import=false and lower(coalesce(status::text,'')) in ('cancelled','canceled')) cancelled
  from a group by 1 order by 1),
hr as (select extract(hour from created_at at time zone 'Asia/Dhaka')::int hour_key,count(*) filter(where lower(coalesce(source::text,''))='web' and originated_from_import=false) orders from a group by 1),
ev as (select ae.order_id,ae.actor_id,ae.action,ae.created_at from public.order_action_events ae where ae.created_at between p_from and p_to),
ep as (select e.user_id,e.name,count(*) filter(where ev.action='confirm') confirmed,count(*) filter(where ev.action='cancel') cancelled,count(*) filter(where ev.action in ('confirm','cancel')) total from public.employees e left join ev on ev.actor_id=e.user_id where e.is_active=true group by e.user_id,e.name order by confirmed desc)
select jsonb_build_object(
'real',jsonb_build_object(
 'created',(select count(*) from public.dashboard_web_order_history h where h.first_counted_at between p_from and p_to),
 'total',(select count(*) from public.dashboard_web_order_history h where h.first_counted_at between p_from and p_to),
 'processing',(select count(*) from p),
 'approved',(select count(*) from w where lower(coalesce(status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),
 'pending',(select count(*) from p),
 'cancelled',(select count(*) from x),
 'revenue',(select coalesce(sum(total),0) from c),
 'allRevenue',(select coalesce(sum(total),0) from w)),
'webOrders',jsonb_build_object(
 'total',(select count(*) from public.dashboard_web_order_history h where h.first_counted_at between p_from and p_to),
 'confirmed',(select count(*) from w where lower(coalesce(status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),
 'processing',(select count(*) from p),
 'cancelled',(select count(*) from x)),
'incompleteOrders',jsonb_build_object('total',(select count(*) from i),'confirmed',(select count(*) from i where lower(coalesce(status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),'processing',(select count(*) from i where lower(coalesce(status::text,'')) in ('web_pending','processing')),'cancelled',(select count(*) from i where lower(coalesce(status::text,'')) in ('cancelled','canceled')),'active',(select count(*) from i where lower(coalesce(status::text,'')) not in ('cancelled','canceled'))),
'profit',jsonb_build_object('grossSales',(select coalesce(sum(total),0) from c),'productCost',(select v from ic)),
'sourceBreakdown',coalesce((select jsonb_agg(to_jsonb(s)) from s),'[]'::jsonb),
'daily',coalesce((select jsonb_agg(to_jsonb(dy)) from dy),'[]'::jsonb),
'hourly',coalesce((select jsonb_agg(jsonb_build_object('hour',hour_key,'orders',orders)) from hr),'[]'::jsonb),
'employeePerformance',coalesce((select jsonb_agg(to_jsonb(ep)) from ep),'[]'::jsonb),
'bestSelling',coalesce((select jsonb_agg(to_jsonb(b)) from b),'[]'::jsonb)
);
$function$
;
