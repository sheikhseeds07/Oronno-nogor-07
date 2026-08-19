-- Admin Orders performance indexes
-- Supports status pagination/sorting, invoice ordering, creator lookup, and order-item joins.
create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

create index if not exists idx_orders_status_invoice_no
  on public.orders (status, invoice_no asc);

create index if not exists idx_orders_created_by
  on public.orders (created_by);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);
