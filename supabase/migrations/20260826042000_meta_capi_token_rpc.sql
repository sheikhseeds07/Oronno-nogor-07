-- Secure, pg_net-free Meta CAPI token reader for public server routes.
-- The public /api/public/fb-capi route calls this SECURITY DEFINER function,
-- receives the token server-side only, and sends the event to Meta via fetch.

create or replace function public.get_meta_capi_token()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_active boolean := false;
  v_pixel_id text;
  v_token text;
  v_test_code text;
begin
  select coalesce(config, '{}'::jsonb), coalesce(is_active, false)
    into v_config, v_active
  from public.integrations
  where name = 'facebook_capi'
  limit 1;

  v_pixel_id := nullif(trim(coalesce(
    v_config->>'pixel_id',
    v_config->>'pixelId'
  )), '');

  v_token := nullif(trim(coalesce(
    v_config->>'access_token',
    v_config->>'accessToken',
    v_config->>'conversion_api_access_token',
    v_config->>'conversions_api_access_token',
    v_config->>'capi_access_token'
  )), '');

  v_test_code := nullif(trim(coalesce(
    v_config->>'test_event_code',
    v_config->>'testEventCode'
  )), '');

  return jsonb_build_object(
    'enabled', v_active,
    'pixel_id', v_pixel_id,
    'access_token', v_token,
    'test_event_code', v_test_code,
    'server_events_ready', v_active and v_pixel_id is not null and v_token is not null
  );
end;
$$;

revoke all on function public.get_meta_capi_token() from public;
grant execute on function public.get_meta_capi_token() to anon, authenticated, service_role;
