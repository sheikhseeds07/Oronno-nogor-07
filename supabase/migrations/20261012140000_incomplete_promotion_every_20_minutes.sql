-- Promote incomplete orders after 20 minutes and run the job every 20 minutes.
-- Preserve the existing function logic; change only the age threshold and schedule.
DO $change$
DECLARE
  v_def text;
  v_job record;
BEGIN
  SELECT pg_get_functiondef('public.promote_stale_incomplete_orders()'::regprocedure)
    INTO v_def;

  IF position('interval ''10 minutes''' in v_def) > 0 THEN
    v_def := replace(v_def, 'interval ''10 minutes''', 'interval ''20 minutes''');
    EXECUTE v_def;
  ELSIF position('interval ''20 minutes''' in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not find expected incomplete-order age threshold; no schedule changes made';
  END IF;

  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%promote_stale_incomplete_orders%'
       OR jobname = 'promote_stale_incomplete_orders'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'promote_stale_incomplete_orders',
    '*/20 * * * *',
    'select public.promote_stale_incomplete_orders();'
  );
END
$change$;
