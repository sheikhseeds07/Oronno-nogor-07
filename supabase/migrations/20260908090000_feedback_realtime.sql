-- Realtime + admin reply support for customer feedback
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE public.product_questions ADD COLUMN IF NOT EXISTS answer text;
ALTER TABLE public.product_questions ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE public.social_post_comments ADD COLUMN IF NOT EXISTS replied_at timestamptz;

ALTER TABLE public.product_reviews REPLICA IDENTITY FULL;
ALTER TABLE public.product_questions REPLICA IDENTITY FULL;
ALTER TABLE public.social_post_comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='product_reviews') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reviews;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='product_questions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_questions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='social_post_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_comments;
  END IF;
END $$;

GRANT ALL ON public.product_reviews TO service_role;
GRANT ALL ON public.product_questions TO service_role;
GRANT ALL ON public.social_post_comments TO service_role;
