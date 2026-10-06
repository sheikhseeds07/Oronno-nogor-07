-- Courier sync: one full cycle per day (23h cooldown inside the function).
-- Hourly wake-up only resumes an unfinished cycle or retries failed orders,
-- so every shipped order is still checked at least once a day.
select cron.schedule(
  'steadfast_status_sync',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := 'https://frtzlibogmethppqmhtr.supabase.co/functions/v1/steadfast-status-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-courier-sync-secret', (select secret from public.system_job_secrets where name = 'steadfast_status_sync')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    ) as request_id;
  $cron$
);
