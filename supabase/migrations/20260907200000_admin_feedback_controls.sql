-- Admin feedback controls. Additive only; existing customer/community logic remains unchanged.
alter table public.product_reviews add column if not exists admin_reply text;
alter table public.product_reviews add column if not exists replied_at timestamptz;
alter table public.social_post_comments add column if not exists admin_reply text;
alter table public.social_post_comments add column if not exists replied_at timestamptz;
create index if not exists product_reviews_reply_idx on public.product_reviews(replied_at, created_at desc);
create index if not exists social_post_comments_reply_idx on public.social_post_comments(replied_at, created_at desc);
grant all on public.product_reviews, public.product_questions, public.social_post_comments to service_role;
