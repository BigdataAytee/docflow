-- DocFlow §E — the payments ledger.
--
-- Rule #4: payments are ledger records, receipts are views of payments,
-- balances are computed. Nothing here stores a balance or a "paid" flag.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor > 0),
  paid_at timestamptz not null,
  method text not null,
  reference text,
  source text not null default 'manual' check (source in ('manual', 'provider')),
  -- The idempotency handle for a provider event: a replayed webhook changes
  -- nothing (§M, §U).
  external_event_id text,
  created_by uuid references public.users(id) on delete set null,
  -- Amendments are reversal + replacement, never an edit (§E).
  reversal_of_id uuid references public.payments(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index payments_company_id_idx on public.payments (company_id);
create index payments_customer_id_idx on public.payments (customer_id);

-- One provider event records at most one payment, per company.
create unique index payments_external_event_unique
  on public.payments (company_id, external_event_id)
  where external_event_id is not null;

-- A payment may be reversed once. A reversal cannot itself be reversed.
create unique index payments_reversal_unique
  on public.payments (reversal_of_id)
  where reversal_of_id is not null;

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.documents(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);

create index payment_allocations_company_id_idx on public.payment_allocations (company_id);
create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_invoice_id_idx on public.payment_allocations (invoice_id);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null references public.documents(id) on delete restrict,
  reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  reason text,
  issued_at timestamptz not null default now(),
  invoice_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint credit_notes_reference_unique unique (company_id, reference)
);

create index credit_notes_company_id_idx on public.credit_notes (company_id);
create index credit_notes_invoice_id_idx on public.credit_notes (invoice_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  category text,
  currency char(3) not null,
  amount_minor bigint not null check (amount_minor > 0),
  spent_on date not null,
  photo_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_company_id_idx on public.expenses (company_id);
