-- DocFlow §E — billing, audit and numbering.

-- Written ONLY by verified store/provider notifications, never by the client
-- (§E, §U). The policies in 0006 give the client no write path at all.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform text not null check (platform in ('apple', 'google', 'web')),
  product_id text not null,
  original_transaction_id text,
  purchase_token text,
  provider_subscription_id text,
  status text not null
    check (status in ('trial', 'active', 'grace', 'on_hold', 'cancelled', 'expired')),
  current_period_end timestamptz,
  auto_renew boolean not null default true,
  price_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_company_id_idx on public.subscriptions (company_id);

-- One entitlement row per company, derived from subscriptions. The device
-- caches the signed payload so Pro survives airplane mode (§U).
create table public.entitlements (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan text not null default 'free',
  features jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  grace_until timestamptz,
  signed_payload text,
  updated_at timestamptz not null default now()
);

-- Append-only (§P). No update or delete policy exists for anyone.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  device_id text,
  action text not null,
  entity text,
  record_id uuid,
  at timestamptz not null default now()
);

create index audit_log_company_id_idx on public.audit_log (company_id);

-- §M: server-reserved number blocks. Atomic reservation, uniqueness enforced.
create table public.counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null check (doc_type in ('invoice', 'quotation', 'receipt', 'waybill')),
  next_number bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (company_id, doc_type)
);

create table public.numbering_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null check (doc_type in ('invoice', 'quotation', 'receipt', 'waybill')),
  device_id text not null,
  range_start bigint not null,
  range_end bigint not null,
  reserved_at timestamptz not null default now(),
  check (range_end >= range_start)
);

create index numbering_reservations_company_id_idx
  on public.numbering_reservations (company_id);
