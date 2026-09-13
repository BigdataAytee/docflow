-- Idempotency keys, so a retried create never duplicates (§M).
--
-- Every mutation in the repository contract carries a MutationContext with an
-- idempotency key, and the in-memory implementation honours it with a Map.
-- A Map cannot serve the case the rule exists for: the outbox retries after
-- the process that made the first attempt is gone, so the memory holding
-- "I already sent this" is gone with it. Without a column, the retry inserts
-- a second row and the owner has two invoices for one sale.
--
-- So the key lives ON THE ROW, with a unique index per company. That makes the
-- guarantee the database's rather than the client's:
--
--   insert ... on conflict (company_id, idempotency_key) do nothing
--   select ... where idempotency_key = $key
--
-- Two statements, but no transaction is needed and none can be half-applied.
-- The unique index decides the race; whoever loses reads back the row the
-- winner wrote. Two devices replaying the same outbox entry converge on one
-- record, which is §M's "retried creates never duplicate" stated as a
-- constraint rather than as a promise in a comment.
--
-- Scoped per company, not globally, because the keys are DERIVED and therefore
-- deliberately guessable — `rec:<doc>:<YYYY-MM>`, `rct:<payment>`. A global
-- unique index would let one company's key collide with another's and silently
-- swallow the second company's write. Company-scoped, a collision is
-- impossible across the boundary RLS already draws.
--
-- NULL is exempt: a unique index ignores nulls, so rows written by the edge
-- functions and by migrations need no key and never collide with each other.

alter table public.customers      add column idempotency_key text;
alter table public.documents      add column idempotency_key text;
alter table public.payments       add column idempotency_key text;
alter table public.credit_notes   add column idempotency_key text;
alter table public.expenses       add column idempotency_key text;
alter table public.assets         add column idempotency_key text;
alter table public.items          add column idempotency_key text;
alter table public.audit_log      add column idempotency_key text;

create unique index customers_idempotency_key    on public.customers    (company_id, idempotency_key);
create unique index documents_idempotency_key    on public.documents    (company_id, idempotency_key);
create unique index payments_idempotency_key     on public.payments     (company_id, idempotency_key);
create unique index credit_notes_idempotency_key on public.credit_notes (company_id, idempotency_key);
create unique index expenses_idempotency_key     on public.expenses     (company_id, idempotency_key);
create unique index assets_idempotency_key       on public.assets       (company_id, idempotency_key);
create unique index items_idempotency_key        on public.items        (company_id, idempotency_key);
create unique index audit_log_idempotency_key    on public.audit_log    (company_id, idempotency_key);
