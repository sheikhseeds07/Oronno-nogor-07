alter table public.products add column if not exists sort_order integer not null default 0;
create index if not exists products_offer_sort_idx on public.products(is_offer,is_active,is_archived,sort_order,created_at desc);
