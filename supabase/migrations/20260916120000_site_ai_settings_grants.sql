-- Live chat AI settings: ensure the table exists, is service-role only, and uses a current model.
create table if not exists public.site_ai_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gemini',
  api_key text not null default '',
  model text not null default 'gemini-flash-latest',
  updated_at timestamptz not null default now()
);

alter table public.site_ai_settings enable row level security;

revoke all on public.site_ai_settings from anon, authenticated;
grant all on public.site_ai_settings to service_role;

alter table public.site_ai_settings alter column model set default 'gemini-flash-latest';

insert into public.site_ai_settings (provider, api_key, model)
select 'gemini', '', 'gemini-flash-latest'
where not exists (select 1 from public.site_ai_settings);

-- Retired Gemini model ids are no longer served; move them to the current flash model.
update public.site_ai_settings
set model = 'gemini-flash-latest', updated_at = now()
where model ~ '^gemini-(1\.5|2\.0|2\.5)';

-- Admins (and the CEO) manage the key from Admin → Settings → Contact.
grant select, insert, update on public.site_ai_settings to authenticated;
drop policy if exists "Admins manage site ai settings" on public.site_ai_settings;
create policy "Admins manage site ai settings"
  on public.site_ai_settings for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
