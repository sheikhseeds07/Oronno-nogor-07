alter table public.products add column if not exists is_offer boolean not null default false;
alter table public.products add column if not exists is_archived boolean not null default false;

create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_product_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (offer_product_id, product_id)
);

create index if not exists offer_items_offer_idx on public.offer_items(offer_product_id, display_order);
create index if not exists products_offer_visible_idx on public.products(is_offer,is_active,is_archived,created_at desc);

alter table public.offer_items enable row level security;
drop policy if exists offer_items_public_read on public.offer_items;
create policy offer_items_public_read on public.offer_items for select using (
  exists (select 1 from public.products p where p.id = offer_items.offer_product_id and p.is_offer = true and p.is_active = true and p.is_archived = false)
  or has_permission(auth.uid(),'products')
);
drop policy if exists offer_items_staff_write on public.offer_items;
create policy offer_items_staff_write on public.offer_items for all using (has_permission(auth.uid(),'products')) with check (has_permission(auth.uid(),'products'));
