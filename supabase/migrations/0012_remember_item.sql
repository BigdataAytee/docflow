-- The catalogue that builds itself (§L2, §M).
--
-- `remember` is not an insert. §L2's catalogue learns from what gets typed, so
-- saying "cement" twice must raise a count, not create a second entry — the
-- match is on the NAME, and the write is an upsert.
--
-- That cannot be done from the client in one PostgREST call, and the naive
-- two-call version is wrong in a way that only shows up under load:
--
--     read times_used  ->  write times_used + 1
--
-- Two devices remembering the same item at once both read 4 and both write 5.
-- The count is the only thing ordering the suggestion list, so it degrades
-- quietly — the list slowly stops reflecting what the owner actually types.
-- `times_used = times_used + 1` inside one statement cannot lose a count.
--
-- SECURITY INVOKER, for the same reason as `record_payment`: this is called by
-- the client, so it must meet the caller's own policies, and the company comes
-- from their claims rather than an argument.

-- One entry per name per company, case-insensitively. This is what makes the
-- upsert a race rather than a read: "Cement" and "cement" are the same item to
-- the person typing them, and two rows would split one item's history in two.
create unique index items_name_unique on public.items (company_id, lower(name));

create function public.remember_item(
  p_idempotency_key text,
  p_item jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.current_company_id();
  v_item public.items%rowtype;
  v_name text := p_item ->> 'name';
begin
  if v_company is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  if v_name is null or btrim(v_name) = '' then
    raise exception 'An item needs a name.' using errcode = 'check_violation';
  end if;

  -- A replay of THIS mutation must not raise the count a second time. The key
  -- is checked before anything is written, exactly as the repositories do it
  -- for an update (§M).
  select * into v_item
    from public.items
   where company_id = v_company and idempotency_key = p_idempotency_key;
  if v_item.id is not null then
    return to_jsonb(v_item);
  end if;

  insert into public.items (
    company_id, name, unit, last_price_minor, currency, times_used, idempotency_key
  )
  values (
    v_company,
    v_name,
    p_item ->> 'unit',
    (p_item ->> 'last_price_minor')::bigint,
    p_item ->> 'currency',
    1,
    p_idempotency_key
  )
  on conflict (company_id, lower(name)) do update
    set
      -- The count is incremented in place. Never read-then-written.
      times_used = public.items.times_used + 1,
      -- The LAST price, so the catalogue offers what was charged most
      -- recently — but only when this use carried one. A blank must not
      -- erase the price that is there (§L2).
      last_price_minor = coalesce(excluded.last_price_minor, public.items.last_price_minor),
      currency = coalesce(excluded.currency, public.items.currency),
      unit = coalesce(excluded.unit, public.items.unit),
      -- The name is NOT overwritten: the existing spelling wins, so
      -- "cement" typed later does not re-case a catalogue entry the owner
      -- deliberately wrote as "Cement".
      idempotency_key = excluded.idempotency_key,
      updated_at = now()
  returning * into v_item;

  return to_jsonb(v_item);
end $$;

grant execute on function public.remember_item(text, jsonb) to authenticated;
