alter table public.products add column if not exists offer_display_order integer;

with ranked as (
  select id, row_number() over (order by created_at desc, id desc) - 1 as rn
  from public.products
  where is_offer = true and is_archived = false
)
update public.products p
set offer_display_order = r.rn
from ranked r
where p.id = r.id and p.offer_display_order is null;

create index if not exists products_offer_display_order_idx
  on public.products(is_offer, is_active, is_archived, offer_display_order, created_at desc);

create or replace function public.reorder_offers(p_offer_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  offer_id uuid;
begin
  if not has_permission(auth.uid(), 'products') then
    raise exception 'permission denied';
  end if;

  if p_offer_ids is null or array_length(p_offer_ids, 1) is null then
    return;
  end if;

  for i in 1..array_length(p_offer_ids, 1) loop
    offer_id := p_offer_ids[i];
    update public.products
    set offer_display_order = i - 1
    where id = offer_id and is_offer = true and is_archived = false;
  end loop;
end;
$$;

grant execute on function public.reorder_offers(uuid[]) to authenticated;
