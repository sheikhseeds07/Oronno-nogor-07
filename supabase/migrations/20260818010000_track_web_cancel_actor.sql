-- Credit web-order cancellations to the employee who performs the cancellation.
-- The dashboard already reads `assigned_to` for cancellation attribution.
-- When the frontend changes an order directly through Supabase, auth.uid()
-- identifies the employee who pressed Cancel.

create or replace function public.set_order_cancelled_by_auth()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from new.status
     and new.assigned_to is null
     and auth.uid() is not null then
    new.assigned_to := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_cancelled_by_auth on public.orders;
create trigger orders_set_cancelled_by_auth
before update of status on public.orders
for each row
execute function public.set_order_cancelled_by_auth();
