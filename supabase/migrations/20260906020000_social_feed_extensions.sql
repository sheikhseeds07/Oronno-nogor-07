-- Social feed extensions: follows, bookmarks, notifications and safe counters.
-- Idempotent; keeps existing post/reaction/comment/story logic intact.

create table if not exists public.social_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists social_follows_following_idx on public.social_follows(following_id, created_at desc);

create table if not exists public.social_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists social_bookmarks_user_idx on public.social_bookmarks(user_id, created_at desc);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('follow','reaction','comment')),
  post_id uuid references public.social_posts(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists social_notifications_user_idx on public.social_notifications(user_id, created_at desc);

alter table public.social_follows enable row level security;
alter table public.social_bookmarks enable row level security;
alter table public.social_notifications enable row level security;

drop policy if exists sf_read on public.social_follows;
create policy sf_read on public.social_follows for select to anon, authenticated using (true);
drop policy if exists sf_ins on public.social_follows;
create policy sf_ins on public.social_follows for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists sf_del on public.social_follows;
create policy sf_del on public.social_follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists sb_read on public.social_bookmarks;
create policy sb_read on public.social_bookmarks for select to authenticated using (auth.uid() = user_id);
drop policy if exists sb_ins on public.social_bookmarks;
create policy sb_ins on public.social_bookmarks for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists sb_del on public.social_bookmarks;
create policy sb_del on public.social_bookmarks for delete to authenticated using (auth.uid() = user_id);

drop policy if exists sn_read on public.social_notifications;
create policy sn_read on public.social_notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists sn_upd on public.social_notifications;
create policy sn_upd on public.social_notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.social_notify_follow() returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.social_notifications(user_id, actor_id, kind, message)
  values (new.following_id, new.follower_id, 'follow', 'আপনাকে ফলো করেছে');
  return new;
end $fn$;

drop trigger if exists trg_social_follow_notification on public.social_follows;
create trigger trg_social_follow_notification after insert on public.social_follows for each row execute function public.social_notify_follow();

create or replace function public.social_notify_reaction() returns trigger language plpgsql security definer set search_path = public as $fn$
declare owner_id uuid;
begin
  select user_id into owner_id from public.social_posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.social_notifications(user_id, actor_id, kind, post_id, message)
    values (owner_id, new.user_id, 'reaction', new.post_id, 'আপনার পোস্টে রিয়েক্ট করেছে');
  end if;
  return new;
end $fn$;

drop trigger if exists trg_social_reaction_notification on public.social_post_reactions;
create trigger trg_social_reaction_notification after insert on public.social_post_reactions for each row execute function public.social_notify_reaction();

create or replace function public.social_notify_comment() returns trigger language plpgsql security definer set search_path = public as $fn$
declare owner_id uuid;
begin
  select user_id into owner_id from public.social_posts where id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id and new.status = 'approved' then
    insert into public.social_notifications(user_id, actor_id, kind, post_id, message)
    values (owner_id, new.user_id, 'comment', new.post_id, 'আপনার পোস্টে কমেন্ট করেছে');
  end if;
  return new;
end $fn$;

drop trigger if exists trg_social_comment_notification on public.social_post_comments;
create trigger trg_social_comment_notification after insert on public.social_post_comments for each row execute function public.social_notify_comment();

grant select, insert, delete on public.social_follows to authenticated;
grant select on public.social_follows to anon;
grant select, insert, delete on public.social_bookmarks to authenticated;
grant select, update on public.social_notifications to authenticated;
grant all on public.social_follows, public.social_bookmarks, public.social_notifications to service_role;
