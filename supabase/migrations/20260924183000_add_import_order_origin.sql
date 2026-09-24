alter table public.orders
  add column if not exists originated_from_import boolean not null default false;

create index if not exists orders_originated_from_import_idx
  on public.orders(originated_from_import)
  where originated_from_import = true;
