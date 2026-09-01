-- Permanent employee action ledger: once a confirm/cancel is recorded for an
-- order it never disappears, and only the acting employee gets the +1.
create table if not exists public.order_action_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  actor_id uuid,
  action text not null check (action in ('confirm','cancel')),
  created_at timestamptz not null default now()
);
create unique index if not exists order_action_events_order_action_key
  on public.order_action_events (order_id, action);
create index if not exists order_action_events_actor_idx
  on public.order_action_events (actor_id, action, created_at desc);

grant select on public.order_action_events to authenticated;
grant all on public.order_action_events to service_role;
alter table public.order_action_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_action_events' and policyname='staff_can_read_action_events') then
    create policy "staff_can_read_action_events" on public.order_action_events
      for select to authenticated
      using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'orders'));
  end if;
end $$;

create or replace function public.record_order_action_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(coalesce(new.status::text,''));
  v_old text := lower(coalesce(case when tg_op='UPDATE' then old.status::text else null end,''));
  v_actor uuid;
begin
  if tg_op = 'UPDATE' and v_status = v_old then
    return new;
  end if;

  if v_status in ('pending','rts','shipped','delivered','pending_return','returned','partial') then
    v_actor := coalesce(new.confirmed_by, auth.uid(), new.created_by, new.assigned_to);
    insert into public.order_action_events (order_id, actor_id, action, created_at)
    values (new.id, v_actor, 'confirm', coalesce(new.confirmed_at, now()))
    on conflict (order_id, action) do nothing;
  elsif v_status in ('cancelled','canceled') then
    v_actor := coalesce(auth.uid(), new.assigned_to, new.created_by);
    insert into public.order_action_events (order_id, actor_id, action, created_at)
    values (new.id, v_actor, 'cancel', now())
    on conflict (order_id, action) do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_record_order_action_event on public.orders;
create trigger trg_record_order_action_event
  after insert or update of status on public.orders
  for each row execute function public.record_order_action_event();

-- Backfill from current data so history is not lost.
insert into public.order_action_events (order_id, actor_id, action, created_at)
select o.id, coalesce(o.confirmed_by, o.created_by, o.assigned_to), 'confirm',
       coalesce(o.confirmed_at, o.created_at)
from public.orders o
where lower(coalesce(o.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')
on conflict (order_id, action) do nothing;

insert into public.order_action_events (order_id, actor_id, action, created_at)
select o.id, coalesce(o.assigned_to, o.created_by), 'cancel', o.updated_at
from public.orders o
where lower(coalesce(o.status::text,'')) in ('cancelled','canceled')
on conflict (order_id, action) do nothing;

CREATE OR REPLACE FUNCTION public.dashboard_egress_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with
 o as (select id,source::text as source,status::text as status,total,created_at,created_by,assigned_to,confirmed_at,confirmed_by from public.orders where created_at between p_from and p_to),
 d as (select id,(order_data->>'source')::text as source,original_status::text as status,total,original_created_at as created_at,null::uuid as created_by,null::uuid as assigned_to,nullif(order_data->>'confirmed_at','')::timestamptz as confirmed_at,nullif(order_data->>'confirmed_by','')::uuid as confirmed_by from public.deleted_orders where original_created_at between p_from and p_to),
 a as (select * from o union all select d.* from d where not exists(select 1 from o where o.id=d.id)),
 r as (select * from a where lower(coalesce(a.source::text,''))<>'incomplete'),
 w as (select * from r where lower(coalesce(r.source::text,''))='web'),
 i as (select * from a where lower(coalesce(a.source::text,''))='incomplete'),
 c as (select * from r where lower(coalesce(r.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),
 p as (select * from w where lower(coalesce(w.status::text,'')) in ('web_pending','processing')),
 x as (select * from w where lower(coalesce(w.status::text,'')) in ('cancelled','canceled')),
 ic as (select coalesce(sum(oi.quantity*coalesce(pr.cost,0)),0) v from public.order_items oi join c on c.id=oi.order_id left join public.products pr on pr.id=oi.product_id),
 b as (select oi.product_id,max(oi.product_name) product_name,sum(oi.quantity) units,sum(oi.subtotal) revenue from public.order_items oi join c on c.id=oi.order_id group by oi.product_id order by units desc limit 10),
 s as (select coalesce(a.source::text,'unknown') source,count(*) count,coalesce(sum(total),0) revenue from a group by 1 order by count desc),
 dy as (select to_char(created_at at time zone 'Asia/Dhaka','YYYY-MM-DD') day_key,count(*) filter(where lower(coalesce(a.source::text,''))='web') created,count(*) filter(where lower(coalesce(a.source::text,''))='web' and lower(coalesce(a.status::text,'')) in ('web_pending','processing')) processing,count(*) filter(where lower(coalesce(a.source::text,''))='web' and lower(coalesce(a.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')) confirmed,count(*) filter(where lower(coalesce(a.source::text,''))='web' and lower(coalesce(a.status::text,'')) in ('cancelled','canceled')) cancelled from a group by 1 order by 1),
 hr as (select extract(hour from created_at at time zone 'Asia/Dhaka')::int hour_key,count(*) filter(where lower(coalesce(a.source::text,''))='web') orders from a group by 1),
 ev as (select ae.order_id,ae.actor_id,ae.action,ae.created_at from public.order_action_events ae where ae.created_at between p_from and p_to),
 ep as (select e.user_id,e.name,
   count(*) filter(where ev.action='confirm') confirmed,
   count(*) filter(where ev.action='cancel') cancelled,
   count(*) filter(where ev.action in ('confirm','cancel')) total
   from public.employees e left join ev on ev.actor_id=e.user_id
   where e.is_active=true group by e.user_id,e.name order by confirmed desc)
select jsonb_build_object('real',jsonb_build_object('created',(select count(*) from w),'total',(select count(*) from w),'processing',(select count(*) from p),'approved',(select count(*) from w where lower(coalesce(w.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),'pending',(select count(*) from p),'cancelled',(select count(*) from x),'revenue',(select coalesce(sum(total),0) from c),'allRevenue',(select coalesce(sum(total),0) from w)),'webOrders',jsonb_build_object('total',(select count(*) from w),'confirmed',(select count(*) from w where lower(coalesce(w.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),'processing',(select count(*) from p),'cancelled',(select count(*) from x)),'incompleteOrders',jsonb_build_object('total',(select count(*) from i),'confirmed',(select count(*) from i where lower(coalesce(i.status::text,'')) in ('pending','rts','shipped','delivered','pending_return','returned','partial')),'processing',(select count(*) from i where lower(coalesce(i.status::text,'')) in ('web_pending','processing')),'cancelled',(select count(*) from i where lower(coalesce(i.status::text,'')) in ('cancelled','canceled')),'active',(select count(*) from i where lower(coalesce(i.status::text,'')) not in ('cancelled','canceled'))),'profit',jsonb_build_object('grossSales',(select coalesce(sum(total),0) from c),'productCost',(select v from ic)),'sourceBreakdown',coalesce((select jsonb_agg(to_jsonb(s)) from s),'[]'::jsonb),'daily',coalesce((select jsonb_agg(to_jsonb(dy)) from dy),'[]'::jsonb),'hourly',coalesce((select jsonb_agg(jsonb_build_object('hour',hour_key,'orders',orders)) from hr),'[]'::jsonb),'employeePerformance',coalesce((select jsonb_agg(to_jsonb(ep)) from ep),'[]'::jsonb),'bestSelling',coalesce((select jsonb_agg(to_jsonb(b)) from b),'[]'::jsonb));
$function$
;
