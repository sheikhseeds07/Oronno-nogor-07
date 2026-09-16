create table if not exists public.site_ai_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gemini',
  api_key text not null default '',
  model text not null default 'gemini-2.5-flash',
  updated_at timestamptz not null default now()
);

alter table public.site_ai_settings enable row level security;

insert into public.site_ai_settings (provider, api_key, model)
select 'gemini', '', 'gemini-2.5-flash'
where not exists (select 1 from public.site_ai_settings);

revoke all on public.site_ai_settings from anon, authenticated;
