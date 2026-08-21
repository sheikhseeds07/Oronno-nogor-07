-- Emergency egress protection for courier-history lookups.
-- Keep successful provider responses reusable for 24 hours even if an older
-- Edge Function version writes a shorter expires_at value.
create or replace function public.enforce_courier_history_cache_ttl()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.configured = true
     and new.error is null
     and new.fetched_at is not null then
    new.expires_at := greatest(
      coalesce(new.expires_at, new.fetched_at),
      new.fetched_at + interval '24 hours'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists courier_history_cache_ttl_guard on public.courier_history_cache;
create trigger courier_history_cache_ttl_guard
before insert or update of fetched_at on public.courier_history_cache
for each row
execute function public.enforce_courier_history_cache_ttl();
