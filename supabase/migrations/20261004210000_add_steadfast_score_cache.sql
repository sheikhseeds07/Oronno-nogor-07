alter table public.courier_history_cache
  add column if not exists steadfast_score jsonb null;
