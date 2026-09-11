-- DocFlow §E — customers and documents.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null default 'person' check (kind in ('company', 'person')),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  labels text[] not null default '{}',
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index customers_company_id_idx on public.customers (company_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Internal, never localised: a delivery document is `waybill` everywhere (§D).
  type text not null check (type in ('invoice', 'quotation', 'receipt', 'waybill')),
  status text not null default 'draft',

  -- Frozen at issue and never rewritten by a later edit, sync or region
  -- change (§M). NULL while the document is still a draft.
  issued_reference text,
  internal_sequence bigint,
  provisional_number text,
  frozen_labels jsonb,

  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb,

  line_items jsonb not null default '[]'::jsonb,
  -- Money in integer minor units. No float ever holds an amount (§K).
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  wht_minor bigint not null default 0,
  total_minor bigint not null default 0,
  currency char(3) not null,

  issue_date date,
  due_date date,
  valid_until date,

  related_invoice_id uuid references public.documents(id) on delete set null,
  converted_from_id uuid references public.documents(id) on delete set null,
  converted_to_id uuid references public.documents(id) on delete set null,
  recurrence jsonb,

  -- §E waybill fields. A delivery document carries no money anywhere (§G, §V).
  driver_name text,
  vehicle_number text,
  dispatch_date date,
  expected_delivery_date date,
  signer_name text,
  signer_role text,
  signed_at timestamptz,
  signature_asset_id uuid,
  delivery_photo_asset_id uuid,
  quantities_confirmed boolean,

  template_id text,
  design_overrides jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  -- §M: the server enforces company/type/reference uniqueness.
  constraint documents_issued_reference_unique
    unique (company_id, type, issued_reference)
);

create index documents_company_id_idx on public.documents (company_id);
create index documents_company_type_idx on public.documents (company_id, type);
create index documents_customer_id_idx on public.documents (customer_id);

-- A delivery document carries no money. Enforced here so no client, sync
-- payload or future migration can put a price on one (§G, §I, §V).
alter table public.documents add constraint documents_waybill_carries_no_money
  check (
    type <> 'waybill'
    or (subtotal_minor = 0 and discount_minor = 0
        and tax_minor = 0 and wht_minor = 0 and total_minor = 0)
  );

-- Withholding tax is an invoice concept only (§I).
alter table public.documents add constraint documents_wht_is_invoice_only
  check (type = 'invoice' or wht_minor = 0);

-- §P: the public-link token hash is "stored server-side, separate from general
-- document reads". Kept in its own table rather than a column, so no client
-- policy, view or careless `select *` can ever surface it.
create table public.document_signing_tokens (
  document_id uuid primary key references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  -- Invalidated after signing or 14 days; a used link cannot alter evidence.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index document_signing_tokens_company_id_idx
  on public.document_signing_tokens (company_id);
