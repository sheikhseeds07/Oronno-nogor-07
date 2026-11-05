create or replace function public.guard_order_shipped_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'shipped' and old.status is distinct from new.status then
    if old.status in ('pending', 'web_pending') then
      raise exception using
        errcode = '23514',
        message = 'Order must be in RTS before it can be marked Shipped';
    end if;

    if old.status = 'rts' and nullif(btrim(coalesce(new.courier_consignment, '')), '') is null then
      raise exception using
        errcode = '23514',
        message = 'Courier consignment is required before an RTS order can be marked Shipped';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_shipped_transition on public.orders;

create trigger trg_guard_order_shipped_transition
before update of status on public.orders
for each row
execute function public.guard_order_shipped_transition();
