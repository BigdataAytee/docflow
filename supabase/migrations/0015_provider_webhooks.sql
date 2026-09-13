-- Provider payment webhooks (§Q Phase 5, §271, §P).
--
-- §271: "provider-backed payments are confirmed only by a verified, idempotent
-- provider event." §Q's gate: "a confirmed provider event records exactly one
-- payment."
--
-- Two things are needed and neither existed: somewhere to keep the secret a
-- signature is checked against, and a write that cannot record the same money
-- twice.

-- ---------------------------------------------------------------- credentials
--
-- Each business connects THEIR OWN provider account, so the secret is
-- per-company. The webhook URL is configured by the merchant in the provider's
-- dashboard, which is why the company is named in the path rather than found
-- from the event: nothing in a Paystack charge says which DocFlow company it
-- belongs to, and we do not create the charge.
--
-- A company id in a URL is not a secret and is not treated as one. It says
-- WHICH secret to check against; the signature is the whole of the
-- authentication, exactly as a document id is not what opens a public link.
--
-- RLS is enabled with NO POLICY AT ALL for `authenticated`. That is the same
-- default-deny shape as `subscriptions` and `entitlements` (§U, CLAUDE.md):
-- the client cannot read these rows, cannot write them, and cannot learn
-- whether a row exists. Only the edge function, holding service_role, can.
--
-- Worth stating plainly because it is a real risk the owner is taking:
-- Paystack signs with the MERCHANT SECRET KEY, which is the same key that can
-- move money. There is no separate webhook-only secret to use instead.
-- Flutterwave's secret hash is verification-only and carries no such power,
-- and PayPal needs a webhook id rather than a key. So of the three, the
-- Paystack row is the one whose leak would be serious on its own.
create table public.payment_provider_credentials (
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('paystack', 'flutterwave', 'paypal')),
  -- Paystack: the merchant secret key. Flutterwave: the dashboard secret hash.
  secret text,
  -- PayPal: the webhook id its verification call requires.
  webhook_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, provider)
);

alter table public.payment_provider_credentials enable row level security;
alter table public.payment_provider_credentials force row level security;
grant select, insert, update, delete on public.payment_provider_credentials to authenticated;
grant all on public.payment_provider_credentials to service_role;

comment on table public.payment_provider_credentials is
  'Per-company provider secrets. No client policy exists, by design: only service_role reads these (§P).';

-- ------------------------------------------------------- one payment per event
--
-- `payments.external_event_id` and its unique index already existed, unused.
-- This is the write that uses them.
--
-- SECURITY DEFINER *and* service-role-only, unlike `record_payment`: there is
-- no signed-in user here at all. A webhook arrives from a provider, and the
-- edge function acts for a company that nobody is logged into. `authenticated`
-- is deliberately not granted execute — a client that could call this could
-- invent money for itself.
--
-- The idempotency is the unique index, not a check-then-insert: two
-- deliveries of one event arriving at the same moment would both see nothing
-- and both write. `on conflict do nothing` lets the index decide, and the
-- read-back returns the payment the winner wrote, so a replay is a no-op that
-- still answers truthfully (§M).
create function public.record_provider_payment(
  p_company_id uuid,
  p_external_event_id text,
  p_customer_id uuid,
  p_currency text,
  p_amount_minor bigint,
  p_paid_at timestamptz,
  p_method text,
  p_reference text,
  p_invoice_id uuid default null,
  p_allocate_minor bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_allocate bigint;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'A payment needs an amount above nothing.' using errcode = 'check_violation';
  end if;

  insert into public.payments (
    company_id, customer_id, currency, amount_minor, paid_at, method, reference,
    source, external_event_id
  )
  values (
    p_company_id, p_customer_id, p_currency, p_amount_minor, p_paid_at, p_method, p_reference,
    'provider', p_external_event_id
  )
  -- The index is PARTIAL (`where external_event_id is not null`, 0003), and a
  -- partial index only arbitrates a conflict when the predicate is repeated
  -- here. Without it Postgres refuses the statement outright rather than
  -- silently skipping the de-duplication — which is the good failure, and the
  -- reason this is tested against a real database rather than assumed.
  on conflict (company_id, external_event_id) where external_event_id is not null do nothing
  returning * into v_payment;

  if v_payment.id is null then
    -- Already recorded. Return it and write no allocation: a second one would
    -- say this money settled twice what it did.
    select * into v_payment
      from public.payments
     where company_id = p_company_id and external_event_id = p_external_event_id;
    return jsonb_build_object('payment', to_jsonb(v_payment), 'recorded', false);
  end if;

  if p_invoice_id is not null then
    -- Never more than arrived, and never more than the invoice still owes.
    -- The caller proposes; this is the last word before the money is durable
    -- (Rule #3), and it is the same rule `record_payment` enforces for a
    -- signed-in owner.
    v_allocate := least(coalesce(p_allocate_minor, p_amount_minor), p_amount_minor);
    if v_allocate > 0 then
      insert into public.payment_allocations (company_id, payment_id, invoice_id, amount_minor)
      values (p_company_id, v_payment.id, p_invoice_id, v_allocate);
    end if;
  end if;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'recorded', true);
end $$;

revoke execute on function public.record_provider_payment(uuid, text, uuid, text, bigint, timestamptz, text, text, uuid, bigint) from public;
grant execute on function public.record_provider_payment(uuid, text, uuid, text, bigint, timestamptz, text, text, uuid, bigint) to service_role;
