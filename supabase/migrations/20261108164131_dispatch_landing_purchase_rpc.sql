-- Allow the public checkout flow to trigger a Purchase only for the exact
-- finalized order attached to its unguessable checkout-intent UUID. Return no PII.
create or replace function public.dispatch_landing_purchase(
  p_intent_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_order_id uuid;
begin
  select final_order_id
    into v_order_id
  from public.landing_checkout_intents
  where id = p_intent_id
    and state = 'finalized';

  if v_order_id is null or v_order_id <> p_order_id then
    return false;
  end if;

  perform public.send_timer_landing_purchase(p_intent_id);
  return true;
end;
$function$;

revoke all on function public.dispatch_landing_purchase(uuid, uuid) from public;
grant execute on function public.dispatch_landing_purchase(uuid, uuid) to anon, authenticated, service_role;
