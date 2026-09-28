alter table public.orders
  add column if not exists shipped_at timestamptz;

create or replace function public.set_order_shipped_at()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.status = 'shipped'
     and (tg_op = 'INSERT' or old.status is distinct from 'shipped') then
    new.shipped_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_set_order_shipped_at on public.orders;

create trigger trg_set_order_shipped_at
before insert or update of status on public.orders
for each row
execute function public.set_order_shipped_at();

update public.orders
set shipped_at = created_at
where status = 'shipped'
  and shipped_at is null;
