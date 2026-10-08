-- Keep Facebook ad-click details on popup checkout intents so timer-finalized
-- orders send a Purchase that Meta can attribute to the ad.
alter table public.landing_checkout_intents
  add column if not exists fbp text,
  add column if not exists fbc text,
  add column if not exists user_agent text,
  add column if not exists source_url text;

create or replace function public.set_landing_intent_tracking(
  p_intent_id uuid, p_fbp text, p_fbc text, p_user_agent text, p_source_url text)
returns void language sql security definer set search_path to 'public' as $$
  update public.landing_checkout_intents
     set fbp = coalesce(nullif(left(trim(p_fbp),200),''), fbp),
         fbc = coalesce(nullif(left(trim(p_fbc),500),''), fbc),
         user_agent = coalesce(nullif(left(trim(p_user_agent),500),''), user_agent),
         source_url = coalesce(nullif(left(trim(p_source_url),2000),''), source_url)
   where id = p_intent_id;
$$;
revoke all on function public.set_landing_intent_tracking(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.set_landing_intent_tracking(uuid,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.send_timer_landing_purchase(p_intent_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare i record; o record; v_ph text; v_items jsonb;
begin
  select * into i from public.landing_checkout_intents where id = p_intent_id;
  if i.final_order_id is null then return; end if;
  select id, total, customer_phone, customer_name, district, thana, client_ip, source into o from public.orders where id = i.final_order_id;
  if o.id is null or coalesce(o.source::text,'') <> 'web' then return; end if;
  v_ph := regexp_replace(coalesce(o.customer_phone,''), '\D', '', 'g');
  if v_ph <> '' and v_ph not like '880%' then v_ph := regexp_replace(v_ph, '^0', '880'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(product_id::text,'landing-item'), 'quantity', quantity, 'item_price', price)), '[]'::jsonb)
    into v_items from public.order_items where order_id = o.id;
  perform public.dispatch_meta_capi_event(jsonb_build_object('data', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'event_name','Purchase','event_time', extract(epoch from now())::bigint,'event_id', o.id::text,'action_source','website',
    'event_source_url', nullif(i.source_url,''),
    'user_data', jsonb_strip_nulls(jsonb_build_object(
       'ph', case when v_ph <> '' then jsonb_build_array(encode(digest(v_ph,'sha256'),'hex')) end,
       'external_id', jsonb_build_array(encode(digest(coalesce(nullif(v_ph,''), o.id::text),'sha256'),'hex'), encode(digest(o.id::text,'sha256'),'hex')),
       'fn', case when nullif(trim(o.customer_name),'') is not null then jsonb_build_array(encode(digest(lower(split_part(trim(o.customer_name),' ',1)),'sha256'),'hex')) end,
       'country', jsonb_build_array(encode(digest('bd','sha256'),'hex')),
       'fbp', nullif(i.fbp,''),
       'fbc', nullif(i.fbc,''),
       'client_user_agent', nullif(i.user_agent,''),
       'client_ip_address', nullif(o.client_ip::text,''))),
    'custom_data', jsonb_build_object('currency','BDT','value', coalesce(o.total,0),'order_id', o.id::text,'contents', v_items,'content_type','product'))))));
exception when others then raise warning 'timer purchase failed: %', sqlerrm;
end $function$;
