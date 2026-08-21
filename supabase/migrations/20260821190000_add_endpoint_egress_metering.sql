create table if not exists public.endpoint_egress_hourly (
  bucket_hour timestamptz not null,
  endpoint text not null,
  method text not null,
  status_class smallint not null,
  request_count bigint not null default 0,
  response_bytes bigint not null default 0,
  primary key (bucket_hour, endpoint, method, status_class),
  created_at timestamptz not null default now()
);

create index if not exists endpoint_egress_hourly_bytes_idx
  on public.endpoint_egress_hourly (bucket_hour desc, response_bytes desc);

alter table public.endpoint_egress_hourly enable row level security;
revoke all on public.endpoint_egress_hourly from anon, authenticated;

drop function if exists public.record_endpoint_egress(jsonb);
create or replace function public.record_endpoint_egress(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_bucket timestamptz;
  v_endpoint text;
  v_method text;
  v_status smallint;
  v_requests bigint;
  v_bytes bigint;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then
    raise exception 'invalid egress metric batch';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_bucket := date_trunc('hour', (r->>'bucket_hour')::timestamptz);
    v_endpoint := left(coalesce(r->>'endpoint','unknown'), 200);
    v_method := left(upper(coalesce(r->>'method','GET')), 10);
    v_status := greatest(0, least(99, coalesce((r->>'status_class')::smallint, 0)));
    v_requests := greatest(0, least(1000000, coalesce((r->>'request_count')::bigint, 0)));
    v_bytes := greatest(0, least(107374182400, coalesce((r->>'response_bytes')::bigint, 0)));

    insert into public.endpoint_egress_hourly(bucket_hour, endpoint, method, status_class, request_count, response_bytes)
    values (v_bucket, v_endpoint, v_method, v_status, v_requests, v_bytes)
    on conflict (bucket_hour, endpoint, method, status_class)
    do update set
      request_count = public.endpoint_egress_hourly.request_count + excluded.request_count,
      response_bytes = public.endpoint_egress_hourly.response_bytes + excluded.response_bytes;
  end loop;
end;
$$;

grant execute on function public.record_endpoint_egress(jsonb) to anon, authenticated;
grant select on public.endpoint_egress_hourly to authenticated;

create policy endpoint_egress_staff_read on public.endpoint_egress_hourly
for select to authenticated
using (is_staff((select auth.uid())));
