create or replace function public.assign_invoice_no()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_next integer;
  v_prefix text := 'AA';
begin
  if new.invoice_no is null and new.status = 'pending' then
    select greatest(coalesce((config->>'next')::integer, 1), 1)
      into v_next
    from public.integrations
    where name = 'invoice_settings'
    for update;

    if v_next is null then
      v_next := coalesce((select max((regexp_match(invoice_no, '^AA([0-9]+)$'))[1]::integer) + 1 from public.orders where invoice_no ~ '^AA[0-9]+$'), 1);
      insert into public.integrations (name, is_active, config, updated_at)
      values ('invoice_settings', true, jsonb_build_object('prefix', v_prefix, 'next', v_next + 1), now())
      on conflict (name) do update
        set config = jsonb_set(public.integrations.config, '{next}', to_jsonb(greatest(coalesce((public.integrations.config->>'next')::integer, v_next + 1), v_next + 1))),
            updated_at = now();
    else
      v_next := greatest(v_next, coalesce((select max((regexp_match(invoice_no, '^AA([0-9]+)$'))[1]::integer) + 1 from public.orders where invoice_no ~ '^AA[0-9]+$'), 1));
      update public.integrations
      set config = jsonb_set(config, '{prefix}', to_jsonb(v_prefix)) || jsonb_build_object('next', v_next + 1),
          updated_at = now()
      where name = 'invoice_settings';
    end if;

    new.invoice_no := v_prefix || v_next;
  end if;
  return new;
end
$$;
