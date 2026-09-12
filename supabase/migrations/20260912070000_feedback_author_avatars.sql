-- Customer avatars on feedback + admin reply fields for comments. Additive only.
alter table public.product_reviews add column if not exists author_avatar text;
alter table public.product_questions add column if not exists author_avatar text;
alter table public.social_post_comments add column if not exists author_avatar text;
alter table public.social_post_comments add column if not exists image_url text;
alter table public.social_post_comments add column if not exists admin_reply text;
alter table public.social_post_comments add column if not exists replied_at timestamptz;
alter table public.product_reviews add column if not exists admin_reply text;
alter table public.product_reviews add column if not exists replied_at timestamptz;
alter table public.product_questions add column if not exists answer text;
alter table public.product_questions add column if not exists answered_at timestamptz;

create index if not exists product_reviews_user_reply_idx on public.product_reviews(user_id, replied_at desc);
create index if not exists product_questions_user_reply_idx on public.product_questions(user_id, answered_at desc);
create index if not exists social_post_comments_user_reply_idx on public.social_post_comments(user_id, replied_at desc);

grant all on public.product_reviews, public.product_questions, public.social_post_comments to service_role;
grant select on public.product_reviews, public.product_questions, public.social_post_comments to anon, authenticated;
