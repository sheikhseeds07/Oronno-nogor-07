-- Fix incomplete -> web_pending timing without changing any other order logic.
-- The 10-minute clock starts from created_at, not updated_at.
-- Cron runs every minute so promotion happens at the first minute tick after 10 minutes.

CREATE OR REPLACE FUNCTION public.promote_stale_incomplete_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  r record;
  new_id uuid;
  promoted int := 0;
  subtotal_calc numeric;
  fee numeric;
  total_calc numeric;
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'incomplete_orders' and c.relkind = 'r'
  ) then
    return 0;
  end if;

  for r in
    select *
    from public.incomplete_orders
    where created_at <= now() - interval '10 minutes'
    order by created_at asc
    limit 200
    for update skip locked
  loop
    if exists (
      select 1
      from public.orders o
      where regexp_replace(o.customer_phone, '\\D', '', 'g') = regexp_replace(r.phone, '\\D', '', 'g')
        and o.created_at >= r.created_at
    ) then
      delete from public.incomplete_orders where id = r.id;
      continue;
    end if;

    if r.items is null or jsonb_typeof(r.items) <> 'array' or jsonb_array_length(r.items) = 0 then
      continue;
    end if;

    select coalesce(sum(
             (coalesce(i->>'price', '0'))::numeric
             * greatest(1, (coalesce(i->>'quantity', '1'))::numeric)
           ), 0)
      into subtotal_calc
    from jsonb_array_elements(r.items) as i;

    fee := coalesce(r.delivery_fee, 0);
    total_calc := coalesce(nullif(r.total, 0), subtotal_calc + fee);

    insert into public.orders (
      customer_name, customer_phone, customer_address, thana, district, notes,
      subtotal, delivery_fee, discount, total,
      source, status, payment_method, originated_from_incomplete
    ) values (
      coalesce(nullif(btrim(coalesce(r.customer_name, '')), ''), r.phone),
      r.phone,
      r.customer_address,
      null,
      r.delivery_zone,
      r.note,
      subtotal_calc, fee, 0, total_calc,
      'incomplete', 'web_pending', 'cod', true
    )
    returning id into new_id;

    update public.orders
       set source = 'incomplete',
           status = 'web_pending',
           originated_from_incomplete = true
     where id = new_id
       and (source::text <> 'incomplete' or status::text <> 'web_pending');

    insert into public.order_items (order_id, product_id, product_name, quantity, price, subtotal)
    select new_id,
           null,
           coalesce(nullif(btrim(coalesce(i->>'name', '')), ''), 'Item'),
           greatest(1, (coalesce(i->>'quantity', '1'))::int),
           (coalesce(i->>'price', '0'))::numeric,
           (coalesce(i->>'price', '0'))::numeric * greatest(1, (coalesce(i->>'quantity', '1'))::int)
    from jsonb_array_elements(r.items) as i;

    if to_regclass('public.incomplete_events') is not null then
      begin
        insert into public.incomplete_events (phone, event) values (r.phone, 'converted');
      exception when others then
        null;
      end;
    end if;

    delete from public.incomplete_orders where id = r.id;
    promoted := promoted + 1;
  end loop;

  return promoted;
end;
$function$;

REVOKE ALL ON FUNCTION public.promote_stale_incomplete_orders() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_stale_incomplete_orders() TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'promote_stale_incomplete_orders';
SELECT cron.schedule(
  'promote_stale_incomplete_orders',
  '* * * * *',
  $$ select public.promote_stale_incomplete_orders(); $$
);
