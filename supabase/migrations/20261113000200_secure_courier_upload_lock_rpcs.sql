-- Secure RPC access for the global courier upload guard.
-- The table remains inaccessible to anon/authenticated; only these permission-checked
-- SECURITY DEFINER functions can claim or update a lock.
create or replace function public.claim_courier_upload_lock(
  p_order_id uuid,
  p_account smallint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_access jsonb;
  v_order_id uuid;
  v_prior public.courier_upload_guard%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_account not in (1, 2) then
    raise exception 'Invalid courier account' using errcode = '22023';
  end if;

  v_access := public.get_my_staff_access();
  if v_access->>'user_id' is distinct from auth.uid()::text
     or not (
       v_access->>'role' in ('admin', 'super_admin')
       or coalesce(v_access->'permissions'->>'orders', 'false') = 'true'
     ) then
    raise exception 'Unauthorized: order management permission required' using errcode = '42501';
  end if;

  insert into public.courier_upload_guard
    (order_id, provider, account, state, created_by)
  values
    (p_order_id, 'steadfast', p_account, 'processing', auth.uid())
  on conflict (order_id) do nothing
  returning order_id into v_order_id;

  if v_order_id is not null then
    return jsonb_build_object('claimed', true);
  end if;

  select * into v_prior
  from public.courier_upload_guard
  where order_id = p_order_id;

  return jsonb_build_object(
    'claimed', false,
    'state', v_prior.state,
    'account', v_prior.account,
    'consignment', v_prior.consignment
  );
end;
$function$;

create or replace function public.update_courier_upload_lock(
  p_order_id uuid,
  p_state text default null,
  p_invoice_no text default null,
  p_consignment text default null,
  p_last_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_access jsonb;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  if p_state is not null and p_state not in ('processing', 'success', 'unknown') then
    raise exception 'Invalid courier lock state' using errcode = '22023';
  end if;

  v_access := public.get_my_staff_access();
  if v_access->>'user_id' is distinct from auth.uid()::text
     or not (
       v_access->>'role' in ('admin', 'super_admin')
       or coalesce(v_access->'permissions'->>'orders', 'false') = 'true'
     ) then
    raise exception 'Unauthorized: order management permission required' using errcode = '42501';
  end if;

  update public.courier_upload_guard
  set state = coalesce(p_state, state),
      invoice_no = coalesce(p_invoice_no, invoice_no),
      consignment = coalesce(p_consignment, consignment),
      last_error = coalesce(p_last_error, last_error),
      resolved_at = case when p_state is not null then now() else resolved_at end,
      updated_at = now()
  where order_id = p_order_id;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$function$;

revoke all on function public.claim_courier_upload_lock(uuid, smallint) from public, anon;
revoke all on function public.update_courier_upload_lock(uuid, text, text, text, text) from public, anon;
grant execute on function public.claim_courier_upload_lock(uuid, smallint) to authenticated;
grant execute on function public.update_courier_upload_lock(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
