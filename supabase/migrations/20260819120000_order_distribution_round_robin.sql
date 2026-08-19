create table if not exists public.order_distribution_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_distribution_state (
  id boolean primary key default true check (id),
  next_position integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.order_distribution_state(id,next_position) values (true,0) on conflict (id) do nothing;

create or replace function public.assign_order_round_robin(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtext('order_distribution_round_robin'));
  if not exists (select 1 from orders where id = p_order_id and assigned_to is null) then
    return (select assigned_to from orders where id = p_order_id);
  end if;

  select next_position into v_next from order_distribution_state where id = true for update;
  select user_id into v_user
  from order_distribution_members
  where enabled = true and position >= v_next
  order by position
  limit 1;
  if v_user is null then
    select user_id into v_user
    from order_distribution_members
    where enabled = true
    order by position
    limit 1;
  end if;
  if v_user is null then return null; end if;

  update orders set assigned_to = v_user, updated_at = now() where id = p_order_id and assigned_to is null;
  if not found then return (select assigned_to from orders where id = p_order_id); end if;

  select coalesce(min(position),0) into v_next from order_distribution_members where enabled = true and position > (select position from order_distribution_members where user_id = v_user);
  update order_distribution_state set next_position = v_next, updated_at = now() where id = true;
  return v_user;
end;
$$;

create or replace function public.auto_assign_processing_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_include_incomplete boolean;
begin
  select coalesce((settings->>'order_distribution_enabled')::boolean,false), coalesce((settings->>'order_distribution_include_incomplete')::boolean,true)
    into v_enabled, v_include_incomplete from site_settings limit 1;
  if not v_enabled then return new; end if;
  if new.assigned_to is not null then return new; end if;
  if new.status::text = 'web_pending' or new.status::text = 'pending' then
    if new.originated_from_incomplete is true and not v_include_incomplete then return new; end if;
    perform public.assign_order_round_robin(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_assign_processing_order on public.orders;
create trigger trg_auto_assign_processing_order
after insert or update of status on public.orders
for each row
when (new.status::text in ('web_pending','pending'))
execute function public.auto_assign_processing_order();

alter table public.order_distribution_members enable row level security;
create policy "authenticated can read order distribution members" on public.order_distribution_members for select to authenticated using (true);
create policy "authenticated can manage order distribution members" on public.order_distribution_members for all to authenticated using (true) with check (true);
