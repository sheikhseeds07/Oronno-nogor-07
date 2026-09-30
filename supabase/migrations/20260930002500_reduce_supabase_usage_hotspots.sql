-- Reduce Supabase API/log churn without changing order semantics.
-- Failed landing checkout fallbacks use backoff instead of retrying/logging every minute.

alter table public.landing_checkout_intents
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz null;

create index if not exists landing_checkout_intents_pending_retry_idx
  on public.landing_checkout_intents (next_retry_at, expires_at)
  where state = 'pending';

create index if not exists landing_checkout_intents_final_order_id_idx
  on public.landing_checkout_intents (final_order_id)
  where final_order_id is not null;

create or replace function public.finalize_expired_landing_checkout_intents()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select id
    from public.landing_checkout_intents
    where state = 'pending'
      and expires_at <= now()
      and (next_retry_at is null or next_retry_at <= now())
    order by expires_at
    for update skip locked
    limit 100
  loop
    begin
      perform public.finalize_landing_checkout_intent(r.id, false);
      update public.landing_checkout_intents
      set retry_count = 0,
          next_retry_at = null
      where id = r.id;
      v_count := v_count + 1;
    exception when others then
      -- Avoid an unbounded RAISE LOG loop. Keep retries, but back them off.
      update public.landing_checkout_intents
      set retry_count = retry_count + 1,
          next_retry_at = now() +
            case
              when retry_count < 1 then interval '5 minutes'
              when retry_count < 2 then interval '15 minutes'
              when retry_count < 3 then interval '30 minutes'
              when retry_count < 4 then interval '1 hour'
              when retry_count < 5 then interval '3 hours'
              else interval '6 hours'
            end
      where id = r.id;
    end;
  end loop;
  return v_count;
end
$function$;

-- Named schedules are idempotent: existing jobs are updated, absent jobs are created.
select cron.schedule(
  'steadfast_status_sync',
  '*/5 * * * *',
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

select cron.schedule(
  'promote_stale_incomplete_orders',
  '*/5 * * * *',
  $cron$ select public.promote_stale_incomplete_orders(); $cron$
);

select cron.schedule(
  'finalize_expired_landing_checkout_intents',
  '*/5 * * * *',
  $cron$ select public.finalize_expired_landing_checkout_intents(); $cron$
);
