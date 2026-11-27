-- Spread existing periodic jobs across separate minutes to reduce pg_cron worker startup contention.
-- Keep each job's original cadence and workload unchanged.
select cron.alter_job(job_id := 1, schedule := '1,11,21,31,41,51 * * * *');
select cron.alter_job(job_id := 4, schedule := '3,13,23,33,43,53 * * * *');
select cron.alter_job(job_id := 18, schedule := '7,27,47 * * * *');
