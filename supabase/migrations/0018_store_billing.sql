-- Store billing: the event ledger and the one write path (§Q Phase 7, §U, §V).
--
-- §U: store notifications are "signature-verified and idempotently applied
-- (replayed events change nothing) into `subscriptions`, which derives one
-- `entitlements` row per company."
-- §V's gate: "Replayed or out-of-order billing webhooks change nothing."
--
-- `subscriptions` and `entitlements` have existed since 0005 and nothing has
-- ever written to them. This is what writes to them — and only this. CLAUDE.md:
-- never from the client, service-role edge functions only. Neither table gets
-- an insert, update or delete policy here, so a user token cannot reach them
-- however the client is edited.
--
-- The ledger is the idempotence. A store's own notification id is the key, and
-- a duplicate delivery is a primary-key conflict rather than a decision.

create table public.store_billing_events (
  -- The STORE's id for the notification. Apple's notificationUUID, Google's
  -- message id. Not ours: ours would be minted per delivery, and a retry
  -- would mint a second one.
  event_id text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  platform text not null check (platform in ('apple', 'google', 'web')),
  kind text not null,
  -- When the STORE says it happened. Ordering turns on this and never on
  -- arrival: a retried renewal landing after the expiry that followed it
  -- would otherwise resurrect a dead subscription.
  occurred_at timestamptz not null,
  applied boolean not null default false,
  -- Why, when it was not applied. 'older_than_state' is the interesting one
  -- and is worth being able to count in production.
  skipped_reason text,
  received_at timestamptz not null default now()
);

alter table public.store_billing_events enable row level security;
alter table public.store_billing_events force row level security;
grant all on public.store_billing_events to service_role;
-- Readable by the company it belongs to: a billing history somebody cannot
-- see is a billing history they cannot query when the charge is wrong.
grant select on public.store_billing_events to authenticated;

create policy store_billing_events_read on public.store_billing_events
  for select to authenticated
  using (company_id = public.current_company_id());

create index store_billing_events_company_idx
  on public.store_billing_events (company_id, occurred_at desc);

-- --------------------------------------------------------------- applying
--
-- One function, service-role only. It decides nothing about WHAT an event
-- means — the edge function normalises Apple's and Google's shapes and passes
-- the decision in — but it owns the two guarantees that must not live in
-- application code: the event is recorded exactly once, and an event older
-- than the state is refused.
create function public.apply_store_billing_event(
  p_event_id text,
  p_company_id uuid,
  p_platform text,
  p_kind text,
  p_occurred_at timestamptz,
  p_status text,
  p_product_id text,
  p_subscription_key text,
  p_period_end timestamptz,
  p_auto_renew boolean,
  p_grace_days integer default 14
) returns jsonb
  language plpgsql volatile security definer
  set search_path = public, pg_temp
as $$
declare
  v_last timestamptz;
  v_best timestamptz;
begin
  -- Replay. The ledger is the check, so two deliveries racing each other
  -- cannot both win: the second conflicts.
  insert into public.store_billing_events (event_id, company_id, platform, kind, occurred_at)
  values (p_event_id, p_company_id, p_platform, p_kind, p_occurred_at)
  on conflict (event_id) do nothing;

  if not found then
    return jsonb_build_object('applied', false, 'why', 'already_seen');
  end if;

  -- Out of order. Judged against the newest event already APPLIED for this
  -- company, by the store's clock.
  select max(occurred_at) into v_last
    from public.store_billing_events
   where company_id = p_company_id and applied and event_id <> p_event_id;

  if v_last is not null and p_occurred_at < v_last then
    update public.store_billing_events
       set skipped_reason = 'older_than_state'
     where event_id = p_event_id;
    return jsonb_build_object('applied', false, 'why', 'older_than_state');
  end if;

  insert into public.subscriptions (
    company_id, platform, product_id, original_transaction_id, status,
    current_period_end, auto_renew, updated_at
  )
  values (
    p_company_id, p_platform, p_product_id, p_subscription_key, p_status,
    p_period_end, coalesce(p_auto_renew, true), now()
  )
  on conflict (company_id, platform, original_transaction_id) do update
     set status = excluded.status,
         product_id = excluded.product_id,
         current_period_end = excluded.current_period_end,
         auto_renew = excluded.auto_renew,
         updated_at = now();

  -- One entitlement per company, derived from every rail it has ever used:
  -- §U's "one company, one plan, whichever rail paid for it". The furthest
  -- paid date wins, so an Apple subscription that lapsed cannot cancel a web
  -- one that did not.
  select max(current_period_end) into v_best
    from public.subscriptions
   where company_id = p_company_id
     and status <> 'expired'
     and current_period_end > now();

  insert into public.entitlements (company_id, plan, valid_until, grace_until, updated_at)
  values (
    p_company_id,
    case when v_best is null then 'free' else 'pro' end,
    v_best,
    case when v_best is null then null else v_best + make_interval(days => p_grace_days) end,
    now()
  )
  on conflict (company_id) do update
     set plan = excluded.plan,
         valid_until = excluded.valid_until,
         grace_until = excluded.grace_until,
         updated_at = now();

  update public.store_billing_events set applied = true where event_id = p_event_id;

  return jsonb_build_object('applied', true, 'plan',
    case when v_best is null then 'free' else 'pro' end);
end;
$$;

revoke all on function public.apply_store_billing_event(
  text, uuid, text, text, timestamptz, text, text, text, timestamptz, boolean, integer
) from public, authenticated, anon;
grant execute on function public.apply_store_billing_event(
  text, uuid, text, text, timestamptz, text, text, text, timestamptz, boolean, integer
) to service_role;

-- The upsert above needs a key to conflict on. One subscription per company
-- per rail per store-side identity.
create unique index subscriptions_rail_identity_idx
  on public.subscriptions (company_id, platform, original_transaction_id);

comment on function public.apply_store_billing_event(
  text, uuid, text, text, timestamptz, text, text, text, timestamptz, boolean, integer
) is
  'Service-role only. Records a store notification once, refuses one older '
  'than the state, and derives the company entitlement. The client never '
  'writes subscriptions or entitlements.';
