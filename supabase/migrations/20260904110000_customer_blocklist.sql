-- Customer blocklist: admin-managed name + IP blocks with server-side checkout enforcement.
create table if not exists public.customer_blocklist (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  ip_address text,
  is_active boolean not null default true,
  blocked_by uuid references auth.users(id) on delete set null,
  blocked_at timestamptz not null default now(),
  unblocked_by uuid references auth.users(id) on delete set null,
  unblocked_at timestamptz,
  unique(customer_name, ip_address)
);
alter table public.customer_blocklist enable row level security;
revoke all on public.customer_blocklist from anon, authenticated;
alter table public.orders add column if not exists client_ip text;
create index if not exists customer_blocklist_active_name_idx on public.customer_blocklist(lower(customer_name)) where is_active;
create index if not exists customer_blocklist_active_ip_idx on public.customer_blocklist(ip_address) where is_active;

create or replace function public.block_customer(p_name text, p_ip text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Customer name is required'; end if;
  insert into public.customer_blocklist(customer_name,ip_address,blocked_by)
  values(trim(p_name),nullif(trim(p_ip),''),auth.uid())
  on conflict (customer_name,ip_address) do update set is_active=true,blocked_by=auth.uid(),blocked_at=now(),unblocked_by=null,unblocked_at=null
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.block_customer(text,text) from public;
grant execute on function public.block_customer(text,text) to authenticated;

create or replace function public.unblock_customer(p_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin access required'; end if;
  update public.customer_blocklist set is_active=false,unblocked_by=auth.uid(),unblocked_at=now() where id=p_id;
  return found;
end $$;
revoke all on function public.unblock_customer(uuid) from public;
grant execute on function public.unblock_customer(uuid) to authenticated;

create or replace function public.list_customer_blocks()
returns setof public.customer_blocklist language sql security definer set search_path=public as $$
  select * from public.customer_blocklist where public.is_admin(auth.uid()) order by is_active desc, blocked_at desc
$$;
revoke all on function public.list_customer_blocks() from public;
grant execute on function public.list_customer_blocks() to authenticated;

-- Re-apply the public checkout function with block enforcement and IP persistence.
create or replace function public.place_public_order(p_customer_name text, p_customer_phone text, p_customer_address text, p_delivery_fee numeric default 50, p_items jsonb default '[]'::jsonb, p_notes text default null, p_client_ip text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order_id uuid; v_subtotal numeric:=0; v_item jsonb; v_product_id uuid; v_product_name text; v_price numeric; v_qty integer;
begin
 if coalesce(trim(p_customer_name),'')='' then raise exception 'Customer name is required'; end if;
 if p_customer_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'Invalid Bangladesh mobile number'; end if;
 if coalesce(trim(p_customer_address),'')='' then raise exception 'Customer address is required'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 then raise exception 'At least one item is required'; end if;
 if coalesce(p_delivery_fee,0)<0 or p_delivery_fee>10000 then raise exception 'Invalid delivery fee'; end if;
 if exists (select 1 from public.customer_blocklist b where b.is_active and (lower(b.customer_name)=lower(trim(p_customer_name)) or (p_client_ip is not null and b.ip_address=p_client_ip))) then raise exception 'আপনাকে block করা হয়েছে'; end if;
 if exists (select 1 from public.order_rate_limit_events e where (e.phone=p_customer_phone or (p_client_ip is not null and e.ip=p_client_ip)) and e.created_at>now()-interval '10 minutes') then raise exception 'Please wait before placing another order'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_product_id:=(v_item->>'id')::uuid; v_qty:=greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)));
   select name,coalesce(sale_price,price) into v_product_name,v_price from public.products where id=v_product_id and is_active=true;
   if not found then raise exception 'Product not found'; end if;
   v_subtotal:=v_subtotal+(v_price*v_qty);
 end loop;
 insert into public.orders(source,status,customer_name,customer_phone,customer_address,notes,subtotal,delivery_fee,discount,total,payment_method,originated_from_incomplete,client_ip)
 values('web','web_pending',trim(p_customer_name),p_customer_phone,trim(p_customer_address),p_notes,v_subtotal,p_delivery_fee,0,v_subtotal+p_delivery_fee,'cod',false,p_client_ip) returning id into v_order_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_product_id:=(v_item->>'id')::uuid; v_qty:=greatest(1,least(1000,coalesce((v_item->>'quantity')::integer,1)));
   select name,coalesce(sale_price,price) into v_product_name,v_price from public.products where id=v_product_id and is_active=true;
   insert into public.order_items(order_id,product_id,product_name,quantity,price,subtotal) values(v_order_id,v_product_id,v_product_name,v_qty,v_price,v_price*v_qty);
 end loop;
 insert into public.order_rate_limit_events(phone,ip) values(p_customer_phone,p_client_ip);
 return v_order_id;
end $$;
