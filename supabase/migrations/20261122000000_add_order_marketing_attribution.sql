-- Keep operational order source (web/manual/messenger/incomplete) separate
-- from ad-platform attribution so a website checkout can still be Facebook Ads.
alter table public.orders
  add column if not exists marketing_source text not null default 'unknown';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_marketing_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_marketing_source_check
      check (marketing_source in ('facebook_ads','tiktok_ads','organic','direct','unknown')) not valid;
  end if;
end $$;

alter table public.orders validate constraint orders_marketing_source_check;

comment on column public.orders.marketing_source is
  'First-touch marketing attribution from ad click identifiers or UTM source; separate from operational orders.source.';
