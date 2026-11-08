-- The raw Meta access token must never be returned to public API callers.
-- The meta-capi-dispatch Edge Function uses the server-side service role to send events.
revoke all on function public.get_meta_capi_token() from public, anon, authenticated;
grant execute on function public.get_meta_capi_token() to service_role;
