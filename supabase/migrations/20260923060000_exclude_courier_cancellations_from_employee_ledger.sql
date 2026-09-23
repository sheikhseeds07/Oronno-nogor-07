-- Prevent courier-originated cancellations from being attributed to employees.
-- Manual/web cancellations continue to be attributed to auth.uid().

create or replace function public.record_order_action_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := lower(coalesce(new.status::text,''));
  v_old text := lower(coalesce(case when tg_op='UPDATE' then old.status::text else null end,''));
  v_courier_status text := lower(coalesce(new.courier_status,''));
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
    -- Courier sync changes shipped -> cancelled and sets courier_status.
    -- That must never create an employee cancellation event.
    if tg_op = 'UPDATE'
       and v_old = 'shipped'
       and v_courier_status in ('cancelled','canceled') then
      return new;
    end if;

    -- Only an authenticated staff action is an employee cancellation.
    v_actor := auth.uid();
    if v_actor is not null then
      insert into public.order_action_events (order_id, actor_id, action, created_at)
      values (new.id, v_actor, 'cancel', now())
      on conflict (order_id, action) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

-- Clean existing courier-originated cancellation events from live/archive data.
delete from public.order_action_events ae
where ae.action = 'cancel'
  and exists (
    select 1 from public.orders o
    where o.id = ae.order_id
      and lower(coalesce(o.courier_status,'')) in ('cancelled','canceled')
  );

delete from public.order_action_events ae
where ae.action = 'cancel'
  and exists (
    select 1 from public.deleted_orders d
    where d.id = ae.order_id
      and lower(coalesce(d.order_data->>'courier_status','')) in ('cancelled','canceled')
  );
