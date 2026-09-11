-- DocFlow §P — row level security on EVERY table, scoped by company_id.
--
-- Two things matter here and both are asserted by supabase/tests:
--
-- 1. ENABLE *and* FORCE. ENABLE alone exempts the table owner, so a migration
--    or any owner-privileged connection would read straight across companies
--    while a two-account denial test still passed. FORCE removes that
--    exemption. The loop below applies both to every table in `public`, so a
--    table added by a future migration cannot quietly miss out.
--
-- 2. Default-deny. A table with RLS on and no matching policy denies
--    everything. Tables the client must never write (subscriptions,
--    entitlements) simply have no write policy — service_role holds BYPASSRLS
--    and does the writing from an edge function (CLAUDE.md).

do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- The company itself. Every other scope hangs off this one.
create policy company_isolation on public.companies
  for all to authenticated
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

-- Every company-scoped table gets the identical read/write scope.
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'customers', 'documents', 'payments', 'payment_allocations',
    'credit_notes', 'expenses', 'assets', 'items', 'logo_projects',
    'logo_concepts', 'counters', 'numbering_reservations'
  ]
  loop
    execute format($f$
      create policy company_isolation on public.%I
        for all to authenticated
        using (company_id = public.current_company_id())
        with check (company_id = public.current_company_id())
    $f$, t);
  end loop;
end $$;

-- Billing is read-only to the client. It is written only by signature-verified,
-- idempotent store and provider notifications (§U) — never by the client.
create policy entitlement_read on public.entitlements
  for select to authenticated
  using (company_id = public.current_company_id());

create policy subscription_read on public.subscriptions
  for select to authenticated
  using (company_id = public.current_company_id());

-- Append-only (§P): select and insert, no update or delete policy for anyone.
create policy audit_read on public.audit_log
  for select to authenticated
  using (company_id = public.current_company_id());

create policy audit_append on public.audit_log
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- public.document_signing_tokens deliberately has NO policy. RLS is on and
-- forced, so every client read and write is denied; only service_role touches
-- it, from the edge function that issues and checks public links (§P).

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_company_id() to authenticated;

-- service_role is the edge functions' identity: it holds BYPASSRLS, so it is
-- the only way billing rows, signing tokens and numbering reservations get
-- written. It is never handed to a client (CLAUDE.md).
grant all on all tables in schema public to service_role;

-- TODO(Phase 7) — service-role penetration checks, tested separately.
-- FORCE closes the table-owner exemption; it does nothing about BYPASSRLS.
-- service_role sees and writes every company by design, so the whole isolation
-- boundary above rests on the service key never reaching a client. A leaked
-- key is a total cross-company compromise and no policy here would stop it.
-- §Q Phase 7 owns the scripted checks (wrong user, wrong role, revoked device)
-- and must also assert no client bundle, log, sync payload or edge-function
-- response ever carries the key. See supabase/tests/rls.test.ts, which asserts
-- the bypass is real so the limitation cannot be skimmed past.
