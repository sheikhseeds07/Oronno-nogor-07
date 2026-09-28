-- Durable landing-page checkout intent.
-- A landing Place Order click is persisted before the NUTRIMIX decision.
-- The browser normally finalizes it; pg_cron is the server-side fallback.

create table if not exists public.landing_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  notes text,
  delivery_fee numeric not null default 0,
  seed_items jsonb not null,
  nutrimix_item jsonb,
  client_ip text,
  state text not null default 'pending' check (state in ('pending','finalized','cancelled')),
  final_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  finalized_at timestamptz
);

create index if not exists landing_checkout_intents_pending_idx
  on public.landing_checkout_intents(state, expires_at)
  where state='pending';

alter table public.landing_checkout_intents enable row level security;
revoke all on public.landing_checkout_intents from anon, authenticated;

create or replace function public.create_landing_checkout_intent(
  p_checkout_session_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_fee numeric,
  p_seed_items jsonb,
  p_nutrimix_item jsonb default null,
  p_notes text default null,
  p_client_ip text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if coalesce(trim(p_customer_name),'')='' then raise exception 'Customer name is required'; end if;
  if p_customer_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Invalid Bangladesh mobile number'; end if;
  if coalesce(trim(p_customer_address),'')='' then raise exception 'Customer address is required'; end if;
  if jsonb_typeof(p_seed_items)<>'array' or jsonb_array_length(p_seed_items)<1 then raise exception 'At least one seed item is required'; end if;
  if coalesce(p_delivery_fee,0)<0 or p_delivery_fee>10000 then raise exception 'Invalid delivery fee'; end if;
  if public.is_blocked_visitor(p_client_ip,p_customer_phone) then raise exception 'আপনাকে block করা হয়েছে'; end if;

  insert into public.landing_checkout_intents(
    checkout_session_id,customer_name,customer_phone,customer_address,notes,
    delivery_fee,seed_items,nutrimix_item,client_ip
  )
  values(
    p_checkout_session_id,trim(p_customer_name),p_customer_phone,trim(p_customer_address),
    p_notes,p_delivery_fee,p_seed_items,p_nutrimix_item,p_client_ip
  )
  on conflict (checkout_session_id) do update
    set customer_name=excluded.customer_name,
        customer_phone=excluded.customer_phone,
        customer_address=excluded.customer_address,
        notes=excluded.notes,
        delivery_fee=excluded.delivery_fee,
        seed_items=excluded.seed_items,
        nutrimix_item=excluded.nutrimix_item,
        client_ip=excluded.client_ip
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text) from public;
grant execute on function public.create_landing_checkout_intent(uuid,text,text,text,numeric,jsonb,jsonb,text,text) to anon, authenticated;

create or replace function public.finalize_landing_checkout_intent(
  p_intent_id uuid,
  p_include_nutrimix boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_intent public.landing_checkout_intents%rowtype;
  v_order_id uuid;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
begin
  select * into v_intent
  from public.landing_checkout_intents
  where id=p_intent_id
  for update;

  if not found then raise exception 'Checkout intent not found'; end if;
  if v_intent.final_order_id is not null then return v_intent.final_order_id; end if;

  if public.is_blocked_visitor(v_intent.client_ip,v_intent.customer_phone) then
    raise exception 'আপনাকে block করা হয়েছে';
  end if;

  for v_item in select value from jsonb_array_elements(v_intent.seed_items) loop
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_item->>'id',''),
      'name',coalesce(v_item->>'name',''),
      'price',greatest(0,coalesce((v_item->>'price')::numeric,0)),
      'quantity',greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)))
    ));
  end loop;

  if p_include_nutrimix and v_intent.nutrimix_item is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',coalesce(v_intent.nutrimix_item->>'id','landing-popup-nutrimix'),
      'name',coalesce(v_intent.nutrimix_item->>'name','NUTRIMIX'),
      'price',greatest(0,coalesce((v_intent.nutrimix_item->>'price')::numeric,0)),
      'quantity',1
    ));
  end if;

  v_order_id := public.place_public_order(
    v_intent.customer_name,
    v_intent.customer_phone,
    v_intent.customer_address,
    v_intent.delivery_fee,
    v_items,
    v_intent.notes,
    v_intent.client_ip
  );

  update public.landing_checkout_intents
    set state='finalized',final_order_id=v_order_id,finalized_at=now()
  where id=v_intent.id;

  return v_order_id;
end $$;

revoke all on function public.finalize_landing_checkout_intent(uuid,boolean) from public;
grant execute on function public.finalize_landing_checkout_intent(uuid,boolean) to anon, authenticated;

create or replace function public.finalize_expired_landing_checkout_intents()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id
    from public.landing_checkout_intents
    where state='pending' and expires_at <= now()
    order by expires_at
    for update skip locked
    limit 100
  loop
    begin
      perform public.finalize_landing_checkout_intent(r.id,false);
      v_count := v_count + 1;
    exception when others then
      raise log 'landing checkout intent % fallback failed: %',r.id,sqlerrm;
    end;
  end loop;
  return v_count;
end $$;

revoke all on function public.finalize_expired_landing_checkout_intents() from public;

do $$
begin
  if not exists (select 1 from cron.job where jobname='finalize_expired_landing_checkout_intents') then
    perform cron.schedule(
      'finalize_expired_landing_checkout_intents',
      '* * * * *',
      $job$ select public.finalize_expired_landing_checkout_intents(); $job$
    );
  end if;
end $$;
