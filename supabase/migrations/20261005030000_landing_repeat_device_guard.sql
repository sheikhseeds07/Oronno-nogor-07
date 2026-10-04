-- Enforce the same phone + device repeat-order rule on landing checkout intents.
-- IP repeat blocking remains intentionally disabled.
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
declare
  v_id uuid;
  v_device_id text := nullif(trim(coalesce(p_device_id,'')), '');
  v_settings jsonb := '{}'::jsonb;
  v_phone_minutes integer := 0;
  v_rate jsonb;
begin
  if coalesce(trim(p_customer_name),'')='' then raise exception 'Customer name is required'; end if;
  if p_customer_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Invalid Bangladesh mobile number'; end if;
  if coalesce(trim(p_customer_address),'')='' then raise exception 'Customer address is required'; end if;
  if jsonb_typeof(p_seed_items)<>'array' or jsonb_array_length(p_seed_items)<1 then raise exception 'At least one seed item is required'; end if;
  if coalesce(p_delivery_fee,0)<0 or p_delivery_fee>10000 then raise exception 'Invalid delivery fee'; end if;
  if public.is_blocked_visitor(p_client_ip,p_customer_phone) then raise exception 'আপনাকে block করা হয়েছে'; end if;

  select coalesce(settings, '{}'::jsonb) into v_settings
  from public.site_settings
  limit 1;

  v_phone_minutes := greatest(
    0,
    least(
      10080,
      coalesce(
        nullif(v_settings->>'order_repeat_phone_minutes','')::integer,
        nullif(v_settings->>'order_phone_repeat_minutes','')::integer,
        0
      )
    )
  );

  if v_phone_minutes > 0 and v_device_id is not null then
    v_rate := public.check_and_touch_order_rate_limit_device(
      p_customer_phone,
      v_device_id,
      v_phone_minutes
    );
    if coalesce((v_rate->>'allowed')::boolean, true) = false then
      raise exception
        'আপনি ইতিমধ্যে একটি অর্ডার করেছেন। দয়া করে অপেক্ষা করুন, আপনাকে কল করা হবে। পরবর্তী অর্ডার করতে আরও % মিনিট অপেক্ষা করুন।',
        greatest(1, coalesce((v_rate->>'wait_minutes')::integer, v_phone_minutes));
    end if;
  end if;

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

revoke all on function public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) from public;
grant execute on function public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text,text) to anon;