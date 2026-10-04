-- Same-device + same-phone repeat-order protection.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.landing_checkout_intents ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS orders_repeat_phone_device_created_idx ON public.orders (public.normalize_bd_phone(customer_phone), device_id, created_at DESC) WHERE source='web' AND device_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_and_touch_order_rate_limit_device(p_phone text,p_device_id text,p_phone_minutes integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_now timestamptz:=clock_timestamp(); v_phone text:=nullif(trim(coalesce(p_phone,'')),''); v_device_id text:=nullif(trim(coalesce(p_device_id,'')),''); v_last timestamptz; v_wait integer:=0;
BEGIN
 IF p_phone_minutes<=0 OR v_phone IS NULL OR v_device_id IS NULL THEN RETURN jsonb_build_object('allowed',true,'wait_minutes',0); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('order-repeat-device:'||public.normalize_bd_phone(v_phone)||'|'||v_device_id,0));
 SELECT max(o.created_at) INTO v_last FROM public.orders o WHERE o.source='web' AND o.device_id=v_device_id AND public.normalize_bd_phone(o.customer_phone)=public.normalize_bd_phone(v_phone);
 IF v_last IS NOT NULL AND v_last+make_interval(mins=>least(10080,greatest(0,p_phone_minutes)))>v_now THEN
  v_wait:=greatest(1,ceil(extract(epoch from ((v_last+make_interval(mins=>least(10080,greatest(0,p_phone_minutes))))-v_now))/60.0)::integer);
 END IF;
 IF v_wait>0 THEN RETURN jsonb_build_object('allowed',false,'wait_minutes',v_wait); END IF;
 RETURN jsonb_build_object('allowed',true,'wait_minutes',0);
END; $function$;



create or replace function public.create_landing_checkout_intent(
  p_checkout_session_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_fee numeric,
  p_seed_items jsonb,
  p_nutrimix_item jsonb default null,
  p_notes text default null,
  p_client_ip text default null,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
declare v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
begin
  if coalesce(trim(p_customer_name),'')='' then raise exception 'Customer name is required'; end if;
  if p_customer_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Invalid Bangladesh mobile number'; end if;
  if coalesce(trim(p_customer_address),'')='' then raise exception 'Customer address is required'; end if;
  if jsonb_typeof(p_seed_items)<>'array' or jsonb_array_length(p_seed_items)<1 then raise exception 'At least one seed item is required'; end if;
  if coalesce(p_delivery_fee,0)<0 or p_delivery_fee>10000 then raise exception 'Invalid delivery fee'; end if;

  insert into public.landing_checkout_intents(
    checkout_session_id,customer_name,customer_phone,customer_address,notes,
    delivery_fee,seed_items,nutrimix_item,client_ip,device_id
  )
  values(
    p_checkout_session_id,trim(p_customer_name),p_customer_phone,trim(p_customer_address),
    p_notes,p_delivery_fee,p_seed_items,p_nutrimix_item,p_client_ip,v_device_id
  )
  on conflict (checkout_session_id) do update
    set customer_name=excluded.customer_name,
        customer_phone=excluded.customer_phone,
        customer_address=excluded.customer_address,
        notes=excluded.notes,
        delivery_fee=excluded.delivery_fee,
        seed_items=excluded.seed_items,
        nutrimix_item=excluded.nutrimix_item,
        client_ip=excluded.client_ip,
        device_id=excluded.device_id
  returning id into v_id;
  return v_id;
end $$;



REVOKE EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.place_public_order(text,text,text,numeric,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalize_landing_checkout_intent(uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_landing_checkout_intent(uuid,boolean) TO service_role;
