
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_participant(uuid, uuid) TO authenticated;
