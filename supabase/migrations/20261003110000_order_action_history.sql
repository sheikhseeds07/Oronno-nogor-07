-- Order action history: immutable audit trail for when an order arrived,
-- was assigned/reassigned, and moved between statuses.
create table if not exists public.order_action_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','assigned','status_changed')),
  from_status public.order_status,
  to_status public.order_status,
  from_assigned_to uuid references auth.users(id) on delete set null,
  to_assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_action_history_order_idx
  on public.order_action_history (order_id, created_at asc, id);
create index if not exists order_action_history_actor_idx
  on public.order_action_history (actor_id, created_at desc);

grant select on public.order_action_history to authenticated;
grant all on public.order_action_history to service_role;
alter table public.order_action_history enable row level security;

drop policy if exists "staff_can_read_order_action_history" on public.order_action_history;
create policy "staff_can_read_order_action_history"
  on public.order_action_history
  for select to authenticated
  using (public.is_admin(auth.uid()) or public.has_permission(auth.uid(),'orders'));

create or replace function public.record_order_action_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.order_action_history
      (order_id, actor_id, action, to_status, to_assigned_to, created_at)
    values
      (new.id, coalesce(new.created_by, new.confirmed_by, new.assigned_to),
       'created', new.status, new.assigned_to, coalesce(new.created_at, now()));

    if new.assigned_to is not null then
      insert into public.order_action_history
        (order_id, actor_id, action, to_assigned_to, created_at)
      values
        (new.id, coalesce(auth.uid(), new.created_by, new.assigned_to),
         'assigned', new.assigned_to, coalesce(new.created_at, now()));
    end if;

    return new;
  end if;

  v_actor := coalesce(auth.uid(), new.confirmed_by, new.created_by, new.assigned_to);

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.order_action_history
      (order_id, actor_id, action, from_assigned_to, to_assigned_to, created_at)
    values
      (new.id, v_actor, 'assigned', old.assigned_to, new.assigned_to, now());
  end if;

  if new.status is distinct from old.status then
    insert into public.order_action_history
      (order_id, actor_id, action, from_status, to_status, created_at)
    values
      (new.id, v_actor, 'status_changed', old.status, new.status, now());
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_record_order_action_history on public.orders;
create trigger trg_record_order_action_history
  after insert or update of status, assigned_to on public.orders
  for each row execute function public.record_order_action_history();

-- Backfill the original arrival point and current assignment/status so existing
-- orders have useful history immediately. Future changes are captured exactly.
insert into public.order_action_history
  (order_id, actor_id, action, to_status, to_assigned_to, created_at)
select
  o.id,
  coalesce(o.created_by, o.confirmed_by, o.assigned_to),
  'created',
  o.status,
  o.assigned_to,
  o.created_at
from public.orders o
where not exists (
  select 1 from public.order_action_history h where h.order_id = o.id and h.action = 'created'
);

insert into public.order_action_history
  (order_id, actor_id, action, to_assigned_to, created_at)
select
  o.id,
  coalesce(o.assigned_to, o.created_by),
  'assigned',
  o.assigned_to,
  coalesce(o.updated_at, o.created_at)
from public.orders o
where o.assigned_to is not null
  and not exists (
    select 1 from public.order_action_history h
    where h.order_id = o.id and h.action = 'assigned'
  );

insert into public.order_action_history
  (order_id, actor_id, action, from_status, to_status, created_at)
select
  o.id,
  coalesce(o.confirmed_by, o.created_by, o.assigned_to),
  'status_changed',
  null,
  o.status,
  coalesce(o.confirmed_at, o.created_at)
from public.orders o
where o.status is not null
  and not exists (
    select 1 from public.order_action_history h
    where h.order_id = o.id and h.action = 'status_changed'
  );
