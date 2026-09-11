-- DocFlow §E — foundation: the company scope everything else hangs from.
--
-- RLS is on EVERY table from the very first migration (§E, §P), and always as
-- ENABLE + FORCE. ENABLE alone exempts the table owner, so migrations and any
-- owner-privileged path would read straight across companies while a denial
-- test still looked green. FORCE closes that. Asserted in supabase/tests.

create extension if not exists "pgcrypto";

-- The company scope, read from the request's JWT claims.
-- Portable on purpose: Supabase sets the `request.jwt.claims` GUC, and so does
-- the CI harness, so the same policies run against both without a shim.
create or replace function public.current_company_id() returns uuid
  language sql stable
as $$
  -- The inner nullif matters: an empty claims GUC cast straight to json raises
  -- "invalid input syntax for type json", so an unauthenticated caller would
  -- get an error instead of an empty result. Guard before the cast.
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'company_id', ''
  )::uuid
$$;

comment on function public.current_company_id() is
  'The caller''s company, from the JWT. NULL when unauthenticated — every policy then denies.';

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_asset_id uuid,
  brand_colour text,
  name_style text not null default 'classic',
  logo_size text not null default 'M',
  -- §D locale profile. Region drives terminology, currency, bank fields, tax
  -- label and date format; language is chosen independently (§S).
  locale_region text not null default 'NG',
  locale_language text not null default 'en',
  label_overrides jsonb not null default '{}'::jsonb,
  currency char(3) not null default 'NGN',
  tax_defaults jsonb not null default '{}'::jsonb,
  numbering_prefixes jsonb not null default '{}'::jsonb,
  bank_fields jsonb not null default '{}'::jsonb,
  enabled_payment_methods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.users (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  permissions jsonb not null default '{}'::jsonb,
  -- Defaults to the company language; a per-user override (§D.4, §S).
  language_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_company_id_idx on public.users (company_id);
