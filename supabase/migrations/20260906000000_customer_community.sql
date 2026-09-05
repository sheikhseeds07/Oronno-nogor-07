-- Customer community: profiles, reviews, questions, social feed. Idempotent.
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique, full_name text, avatar_url text,
  address text, district text, thana text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  rating int not null check (rating between 1 and 5),
  body text, image_urls text[] not null default '{}',
  verified_purchase boolean not null default false,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now());
create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null, question text not null, answer text, answered_at timestamptz,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now());
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null, author_avatar text, body text not null,
  image_urls text[] not null default '{}',
  like_count int not null default 0, comment_count int not null default 0,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now());
create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (post_id, user_id));
create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_name text not null, body text not null,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now());

create index if not exists product_reviews_product_idx on public.product_reviews(product_id, status, created_at desc);
create index if not exists product_questions_product_idx on public.product_questions(product_id, status, created_at desc);
create index if not exists social_posts_feed_idx on public.social_posts(status, created_at desc);
create index if not exists social_post_comments_post_idx on public.social_post_comments(post_id, status, created_at);

grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert on public.product_reviews, public.product_questions, public.social_post_comments to authenticated;
grant select, insert, delete on public.social_posts, public.social_post_likes to authenticated;
grant select on public.product_reviews, public.product_questions, public.social_posts, public.social_post_likes, public.social_post_comments to anon;
grant all on public.customer_profiles, public.product_reviews, public.product_questions, public.social_posts, public.social_post_likes, public.social_post_comments to service_role;

alter table public.customer_profiles enable row level security;
alter table public.product_reviews enable row level security;
alter table public.product_questions enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;

drop policy if exists cp_read on public.customer_profiles;
create policy cp_read on public.customer_profiles for select to authenticated using (auth.uid() = id);
drop policy if exists cp_ins on public.customer_profiles;
create policy cp_ins on public.customer_profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists cp_upd on public.customer_profiles;
create policy cp_upd on public.customer_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists pr_pub on public.product_reviews;
create policy pr_pub on public.product_reviews for select to anon, authenticated using (status = 'approved');
drop policy if exists pr_own on public.product_reviews;
create policy pr_own on public.product_reviews for select to authenticated using (auth.uid() = user_id);
drop policy if exists pr_ins on public.product_reviews;
create policy pr_ins on public.product_reviews for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists pq_pub on public.product_questions;
create policy pq_pub on public.product_questions for select to anon, authenticated using (status = 'approved');
drop policy if exists pq_own on public.product_questions;
create policy pq_own on public.product_questions for select to authenticated using (auth.uid() = user_id);
drop policy if exists pq_ins on public.product_questions;
create policy pq_ins on public.product_questions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists sp_pub on public.social_posts;
create policy sp_pub on public.social_posts for select to anon, authenticated using (status = 'approved');
drop policy if exists sp_own on public.social_posts;
create policy sp_own on public.social_posts for select to authenticated using (auth.uid() = user_id);
drop policy if exists sp_ins on public.social_posts;
create policy sp_ins on public.social_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists sp_del on public.social_posts;
create policy sp_del on public.social_posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists sl_read on public.social_post_likes;
create policy sl_read on public.social_post_likes for select to anon, authenticated using (true);
drop policy if exists sl_ins on public.social_post_likes;
create policy sl_ins on public.social_post_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists sl_del on public.social_post_likes;
create policy sl_del on public.social_post_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists sc_pub on public.social_post_comments;
create policy sc_pub on public.social_post_comments for select to anon, authenticated using (status = 'approved');
drop policy if exists sc_ins on public.social_post_comments;
create policy sc_ins on public.social_post_comments for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.social_sync_counts() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'social_post_likes' then
    update public.social_posts p set like_count = (select count(*) from public.social_post_likes l where l.post_id = pid) where p.id = pid;
  else
    update public.social_posts p set comment_count = (select count(*) from public.social_post_comments c where c.post_id = pid and c.status = 'approved') where p.id = pid;
  end if;
  return null;
end $fn$;

drop trigger if exists trg_social_like_counts on public.social_post_likes;
create trigger trg_social_like_counts after insert or delete on public.social_post_likes
for each row execute function public.social_sync_counts();
drop trigger if exists trg_social_comment_counts on public.social_post_comments;
create trigger trg_social_comment_counts after insert or update or delete on public.social_post_comments
for each row execute function public.social_sync_counts();

create or replace view public.product_rating_summary as
select product_id, count(*)::int as review_count, round(avg(rating)::numeric, 2) as average_rating
from public.product_reviews where status = 'approved' group by product_id;
grant select on public.product_rating_summary to anon, authenticated, service_role;
