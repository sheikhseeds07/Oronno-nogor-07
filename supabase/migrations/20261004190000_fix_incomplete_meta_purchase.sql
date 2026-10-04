-- Fix Meta Purchase attribution: incomplete-source orders are not customer-placed purchases.
-- Remove the trigger introduced by 20261004140000_incomplete_order_meta_purchase.sql.
drop trigger if exists trg_queue_incomplete_order_purchase on public.orders;
drop function if exists public.queue_incomplete_order_purchase();
drop function if exists public.queue_order_purchase_capi(public.orders);

-- Remove only Purchase outbox entries tied to source=incomplete orders.
delete from public.meta_capi_purchase_outbox m
using public.orders o
where o.id = (m.payload->'data'->0->'custom_data'->>'order_id')::uuid
  and o.source = 'incomplete';

-- Keep the durable outbox strictly for real Purchase events.
