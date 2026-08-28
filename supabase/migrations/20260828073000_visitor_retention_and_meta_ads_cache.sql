create table if not exists public.meta_ads_cache(
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.meta_ads_cache enable row level security;
revoke all on public.meta_ads_cache from anon, authenticated;
grant all on public.meta_ads_cache to service_role;

create index if not exists idx_site_visits_created_at on public.site_visits(created_at);
create index if not exists idx_site_visitors_last_seen on public.site_visitors(last_seen);

create or replace function public.purge_visitor_telemetry()
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  delete from public.site_visits where created_at < now() - interval '30 days';
  delete from public.site_visitors where last_seen < now() - interval '1 day';
  delete from public.meta_ads_cache where fetched_at < now() - interval '1 day';
end;
$fn$;
revoke all on function public.purge_visitor_telemetry() from public;
revoke all on function public.purge_visitor_telemetry() from anon, authenticated;
grant execute on function public.purge_visitor_telemetry() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'purge_visitor_telemetry';
select cron.schedule('purge_visitor_telemetry','20 21 * * *', $$select public.purge_visitor_telemetry();$$);
select public.purge_visitor_telemetry();
