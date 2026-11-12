-- Global courier upload lock: one permanent record per order across all accounts.
create table if not exists public.courier_upload_guard (
  order_id uuid primary key references public.orders(id) on delete cascade,
  provider text not null default 'steadfast',
  account smallint not null check (account in (1, 2)),
  invoice_no text,
  state text not null default 'processing'
    check (state in ('processing', 'success', 'unknown', 'rejected')),
  consignment text,
  request_started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_courier_upload_guard_state_created
  on public.courier_upload_guard (state, created_at desc);

alter table public.courier_upload_guard enable row level security;
revoke all on public.courier_upload_guard from anon, authenticated;
grant all on public.courier_upload_guard to service_role;

-- Protect all existing orders that already have a courier tracking reference.
insert into public.courier_upload_guard
  (order_id, provider, account, invoice_no, state, consignment, resolved_at, last_error)
select
  o.id,
  'legacy_existing',
  1,
  o.invoice_no,
  'success',
  o.courier_consignment,
  now(),
  'Backfilled from existing order courier_consignment'
from public.orders o
where nullif(btrim(coalesce(o.courier_consignment, '')), '') is not null
on conflict (order_id) do nothing;
