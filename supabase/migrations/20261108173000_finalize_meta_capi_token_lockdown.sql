-- Apply only after the app has been deployed with the server-only
-- meta-capi-dispatch Edge Function integration. This closes the temporary
-- compatibility grant needed by the currently deployed app.
revoke all on function public.get_meta_capi_token() from public, anon, authenticated;
grant execute on function public.get_meta_capi_token() to service_role;
