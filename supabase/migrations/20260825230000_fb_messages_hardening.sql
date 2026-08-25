-- Facebook Page AI Messages hardening.
-- Only touches the already-existing fb_* module tables/functions; no business tables are altered.

alter table public.fb_conversations enable row level security;
alter table public.fb_messages enable row level security;
alter table public.fb_comments enable row level security;
alter table public.fb_trainer_messages enable row level security;
alter table public.fb_locks enable row level security;

-- Replace/complete staff-only policies without changing table structure.
drop policy if exists staff_read_fb_conversations on public.fb_conversations;
drop policy if exists staff_write_fb_conversations on public.fb_conversations;
drop policy if exists staff_read_fb_messages on public.fb_messages;
drop policy if exists staff_manage_fb_messages on public.fb_messages;
drop policy if exists staff_read_fb_comments on public.fb_comments;
drop policy if exists staff_manage_fb_comments on public.fb_comments;
drop policy if exists "Staff manage trainer chat" on public.fb_trainer_messages;
drop policy if exists staff_manage_fb_trainer_messages on public.fb_trainer_messages;
drop policy if exists staff_manage_fb_locks on public.fb_locks;

create policy staff_read_fb_conversations on public.fb_conversations
  for select to authenticated using (is_staff((select auth.uid())));
create policy staff_manage_fb_conversations on public.fb_conversations
  for all to authenticated
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

create policy staff_read_fb_messages on public.fb_messages
  for select to authenticated using (is_staff((select auth.uid())));
create policy staff_manage_fb_messages on public.fb_messages
  for all to authenticated
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

create policy staff_read_fb_comments on public.fb_comments
  for select to authenticated using (is_staff((select auth.uid())));
create policy staff_manage_fb_comments on public.fb_comments
  for all to authenticated
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

create policy staff_manage_fb_trainer_messages on public.fb_trainer_messages
  for all to authenticated
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

create policy staff_manage_fb_locks on public.fb_locks
  for all to authenticated
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

-- Explicit privileges for the two roles used by the application.
grant select, insert, update, delete, references, trigger on public.fb_conversations to authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.fb_messages to authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.fb_comments to authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.fb_trainer_messages to authenticated, service_role;
grant select, insert, update, delete, references, trigger on public.fb_locks to authenticated, service_role;
grant execute on function public.try_fb_lock(text, integer) to authenticated, service_role;
grant execute on function public.release_fb_lock(text) to authenticated, service_role;

-- Keep the idempotency guarantees explicit.
create unique index if not exists fb_messages_mid_unique_idx on public.fb_messages(mid) where mid is not null;
create unique index if not exists fb_comments_comment_id_unique_idx on public.fb_comments(comment_id);
create index if not exists fb_conversations_page_last_message_idx on public.fb_conversations(page_id, last_message_at desc);
create index if not exists fb_messages_conversation_created_idx on public.fb_messages(conversation_id, created_at);
create index if not exists fb_comments_page_created_idx on public.fb_comments(page_id, created_at desc);

comment on table public.fb_locks is 'Atomic cross-process locks for Facebook AI autopilot and per-item claims.';
