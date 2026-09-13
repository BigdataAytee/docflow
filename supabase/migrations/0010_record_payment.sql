-- Recording a payment and what it settled, in ONE transaction (§E, §K, §M).
--
-- A payment is two tables and one fact: the money that arrived, and what it
-- was put against. PostgREST cannot span both in one call, and two calls can
-- half-succeed in either direction:
--
--   · payment written, allocations lost → the invoice still reads unpaid and
--     the money shows as customer credit. The owner chases a customer who has
--     already paid.
--   · allocations written, payment lost → impossible here (the foreign key
--     refuses), which is the *good* failure, but it leaves the caller having
--     to unwind a write it already made.
--
-- Neither is a state the app could detect and correct afterwards, because
-- nothing in the record says "this was supposed to have allocations". So the
-- pair is one statement from the client, and therefore one transaction.
--
-- SECURITY INVOKER (the default, stated here because it is load-bearing):
-- this is called BY THE CLIENT, so it must run with the caller's rights and
-- meet the same `company_isolation` policies as a plain insert would. A
-- SECURITY DEFINER function here would hand every signed-in user a
-- BYPASSRLS-shaped hole — the exact opposite of what `apply_public_link`
-- needs, which runs from a service-role edge function with no user at all.
--
-- `search_path` is pinned regardless. An unpinned path lets whoever controls a
-- schema earlier in it shadow `payments` with their own table.

create function public.record_payment(
  p_idempotency_key text,
  p_payment jsonb,
  p_allocations jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  -- The company is taken from the CALLER's claims, never from an argument.
  -- A `p_company_id` parameter would be a company id the client chooses, and
  -- the only thing standing behind it would be the RLS `with check` — one
  -- policy edit away from a client writing another company's ledger. Read
  -- from the session, that is not expressible.
  v_company uuid := public.current_company_id();
  v_payment public.payments%rowtype;
  v_amount bigint := (p_payment ->> 'amount_minor')::bigint;
  v_allocated bigint;
begin
  if v_company is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  -- Money is never inferred (Rule #3): allocating more than arrived would
  -- settle a debt with money nobody paid, and the per-row `> 0` check cannot
  -- see a sum. The domain enforces this too; it is repeated here because this
  -- is the last point before the money is durable, and a sync client that
  -- skipped the domain would otherwise write it.
  select coalesce(sum((value ->> 'amount_minor')::bigint), 0)
    into v_allocated
    from jsonb_array_elements(p_allocations) as value;

  if v_allocated > v_amount then
    raise exception 'Allocations (%) exceed the payment (%).', v_allocated, v_amount
      using errcode = 'check_violation';
  end if;

  -- Every invoice must be one this caller can see. The foreign key alone is
  -- not enough: it accepts ANY document id, including another company's,
  -- because a foreign key does not consult RLS. Without this check a client
  -- can allocate its own money against a stranger's invoice — the allocation
  -- row is its own, so `company_isolation` passes it happily, and the result
  -- is a payment permanently attached to a document neither company can
  -- reconcile (and which the other can no longer delete, the reference being
  -- ON DELETE RESTRICT).
  --
  -- The check is an EXISTS under the caller's own rights rather than a
  -- comparison against a company id, so the boundary is still drawn in exactly
  -- one place (§P). An invoice that does not exist fails the same way, which
  -- is correct: money cannot settle a document that is not there.
  if exists (
    select 1
      from jsonb_array_elements(p_allocations) as value
     where not exists (
       select 1 from public.documents d where d.id = (value ->> 'invoice_id')::uuid
     )
  ) then
    raise exception 'An allocation names an invoice that is not yours.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The idempotency key decides the race, exactly as a plain insert would
  -- (0009). A retry writes nothing and falls through to the read below.
  insert into public.payments (
    company_id, customer_id, currency, amount_minor, paid_at, method,
    reference, source, external_event_id, reversal_of_id, idempotency_key
  )
  values (
    v_company,
    (p_payment ->> 'customer_id')::uuid,
    p_payment ->> 'currency',
    v_amount,
    (p_payment ->> 'paid_at')::timestamptz,
    p_payment ->> 'method',
    p_payment ->> 'reference',
    coalesce(p_payment ->> 'source', 'manual'),
    p_payment ->> 'external_event_id',
    (p_payment ->> 'reversal_of_id')::uuid,
    p_idempotency_key
  )
  on conflict (company_id, idempotency_key) do nothing
  returning * into v_payment;

  if v_payment.id is null then
    -- Already recorded. Return what is there and write no allocations: a
    -- second set would double what this money settled, which is the precise
    -- thing §M's "retried creates never duplicate" exists to prevent.
    select * into v_payment
      from public.payments
     where company_id = v_company and idempotency_key = p_idempotency_key;

    if v_payment.id is null then
      -- Neither inserted nor found: the row belongs to another company and
      -- RLS is hiding it. Say so as a conflict rather than returning null.
      raise exception 'That idempotency key is already in use.'
        using errcode = 'unique_violation';
    end if;
  else
    insert into public.payment_allocations (company_id, payment_id, invoice_id, amount_minor)
    select
      v_company,
      v_payment.id,
      (value ->> 'invoice_id')::uuid,
      (value ->> 'amount_minor')::bigint
    from jsonb_array_elements(p_allocations) as value;
  end if;

  return jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'allocations', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.invoice_id)
         from public.payment_allocations a
        where a.payment_id = v_payment.id),
      '[]'::jsonb
    )
  );
end $$;

grant execute on function public.record_payment(text, jsonb, jsonb) to authenticated;
