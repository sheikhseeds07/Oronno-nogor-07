-- Harden Meta CAPI delivery and keep the All API token server-only.
-- The public app server uses the service-role client, so anon/authenticated do not
-- need direct access to the token reader.

revoke all on function public.get_meta_capi_token() from anon, authenticated, public;
grant execute on function public.get_meta_capi_token() to service_role;

create or replace function public.dispatch_meta_capi_event(p_body jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_config jsonb := '{}'::jsonb;
  v_active boolean := false;
  v_pixel_id text;
  v_token text;
  v_event_name text;
  v_source_url text;
  v_request_id bigint;
begin
  if jsonb_typeof(p_body->'data') <> 'array' or jsonb_array_length(p_body->'data') <> 1 then
    return false;
  end if;

  v_event_name := p_body->'data'->0->>'event_name';
  v_source_url := p_body->'data'->0->>'event_source_url';

  if v_event_name not in ('PageView','ViewContent','Search','AddToCart','InitiateCheckout','Lead','Contact','AddToWishlist','CompleteRegistration','Purchase') then
    return false;
  end if;

  if v_source_url is not null and v_source_url !~* '^https://([a-z0-9-]+\\.)*oronnonogor\\.com(/|$)' then
    return false;
  end if;

  select coalesce(config, '{}'::jsonb), coalesce(is_active, false)
    into v_config, v_active
  from public.integrations
  where name = 'facebook_capi'
  limit 1;

  v_pixel_id := nullif(trim(coalesce(v_config->>'pixel_id', v_config->>'pixelId')), '');
  v_token := nullif(trim(coalesce(
    v_config->>'access_token',
    v_config->>'accessToken',
    v_config->>'conversion_api_access_token',
    v_config->>'conversions_api_access_token',
    v_config->>'capi_access_token'
  )), '');

  if not v_active or v_pixel_id is null or v_token is null then
    return false;
  end if;

  select extensions.net.http_post(
    url := 'https://graph.facebook.com/v23.0/' || v_pixel_id || '/events?access_token=' || urlencode(v_token),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := p_body,
    timeout_milliseconds := 15000
  ) into v_request_id;

  return v_request_id is not null;
exception when others then
  raise warning 'Meta CAPI database fallback failed: %', sqlerrm;
  return false;
end;
$$;

revoke all on function public.dispatch_meta_capi_event(jsonb) from public, anon, authenticated;
grant execute on function public.dispatch_meta_capi_event(jsonb) to service_role;
