alter table public.categories
  add column if not exists parent_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_parent_id_fkey'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_parent_id_fkey
      foreign key (parent_id)
      references public.categories(id)
      on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'categories_parent_not_self'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_parent_not_self
      check (parent_id is null or parent_id <> id);
  end if;
end $$;

create index if not exists categories_parent_display_order_idx
  on public.categories(parent_id, display_order, created_at);

create index if not exists categories_home_roots_idx
  on public.categories(display_order, created_at)
  where parent_id is null and is_hidden_from_home = false;
