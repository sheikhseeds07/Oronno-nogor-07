create table if not exists public.steadfast_sync_cursor (
  name text primary key,
  last_id uuid null,
  cycle_started_at timestamptz null,
  cycle_completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.steadfast_sync_cursor enable row level security;

insert into public.steadfast_sync_cursor (name)
values ('steadfast_status_sync')
on conflict (name) do nothing;
