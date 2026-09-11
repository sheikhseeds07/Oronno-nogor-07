create extension if not exists pg_net with schema extensions;

create table if not exists public.system_job_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
alter table public.system_job_secrets enable row level security;
revoke all on public.system_job_secrets from public, anon, authenticated;
grant all on public.system_job_secrets to service_role;

insert into public.system_job_secrets (name, secret)
values ('steadfast_status_sync', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'steadfast_status_sync';
select cron.schedule(
  'steadfast_status_sync',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := 'https://bvuhvzccziuniujeogng.supabase.co/functions/v1/steadfast-status-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-courier-sync-secret', (select secret from public.system_job_secrets where name = 'steadfast_status_sync')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    ) as request_id;
  $$
);
