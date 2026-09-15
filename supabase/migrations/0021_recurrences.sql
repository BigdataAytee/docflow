-- DocFlow §L4 — monthly repeats, server side.
--
-- The device has had this since local schema 4; the hosted half was held back
-- deliberately, and the reason is worth keeping next to the thing it explains.
-- `supabase/tests/rls.test.ts` asserts RLS enabled AND forced on every table,
-- so it catches a table with NO policy and a malformed one. It cannot catch a
-- policy that is present, well formed and SUBTLY WRONG — that passes every
-- assertion and leaks across companies. So the policy waited for a Postgres
-- the suite could actually run against.
--
-- SHAPE MIRRORS THE DEVICE, column for column, because sync compares the two.
-- §E lists "recurrence json" on the documents row; this normalises the same
-- fact into its own table for the reason the device did: one invoice has ONE
-- schedule, and a primary key says so at the level where it cannot be got
-- wrong. Switching Repeat on twice is the same schedule, not two.

create table public.recurrences (
  -- The identity IS the document it repeats. No separate id: there is nothing
  -- a second row for the same document could mean.
  source_document_id uuid primary key references public.documents(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  -- 1–31. A month too short for it uses its own last day; the arithmetic is
  -- in `src/features/recurring/schedule.ts` and never in the database.
  day_of_month smallint not null check (day_of_month between 1 and 31),
  -- Calendar days, never instants. A schedule that started "at 23:40 UTC"
  -- belongs to a different day in Lagos, and §L4's periods are local.
  started_on date not null,
  -- Switched off, rather than deleted: the drafts already made stand, and a
  -- row that vanishes makes "why did this stop?" unanswerable.
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurrences_company_id_idx on public.recurrences (company_id);

-- Which period a draft was created FOR (§L4).
--
-- This is what makes catch-up idempotent across a crash: a run that died
-- halfway finds its own earlier drafts by key and creates only what is still
-- missing. Derived from (document, month) rather than generated, so two
-- devices, a retried upload and an interrupted run all produce the same key
-- without coordinating.
alter table public.documents add column if not exists recurrence_key text;

-- THE INDEX IS THE IDEMPOTENCY, and it is not optional. Two racing catch-ups
-- can both pass a SELECT; they cannot both win a UNIQUE constraint. Partial,
-- so every document somebody made themselves keeps a null key without
-- colliding with every other null.
create unique index if not exists documents_recurrence_key_idx
  on public.documents (recurrence_key)
  where recurrence_key is not null;

-- §P. Enabled AND forced, like every other table — ENABLE alone exempts the
-- table owner, which would let owner-privileged code read straight across
-- companies while a two-account denial test still passed.
alter table public.recurrences enable row level security;
alter table public.recurrences force row level security;

-- The identical scope every company-owned table carries in 0006.
create policy company_isolation on public.recurrences
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

grant select, insert, update, delete on public.recurrences to authenticated;

-- A schedule may only name a document of the SAME company.
--
-- The policy above scopes the row by its own `company_id`, which is not the
-- same claim: a caller could otherwise insert a row carrying their own
-- company id that points at somebody else's document, and the policy would
-- allow it. Row-level security answers "may I write this row"; it does not
-- answer "is this row internally consistent". This does.
--
-- SECURITY DEFINER on purpose, and for the opposite of the usual reason. The
-- guard is the JOINED company_id, not visibility: a document belonging to
-- another company fails `d.company_id = new.company_id` whether or not the
-- caller could ever have seen it. Running as definer makes the answer the
-- same under RLS, under FORCE and for a superuser — so the refusal is a clear
-- message about ownership rather than a confusing one about a row that
-- appears not to exist.
create or replace function public.recurrence_matches_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.documents d
    where d.id = new.source_document_id and d.company_id = new.company_id
  ) then
    raise exception 'A repeat must name a document belonging to the same company (v6 P).';
  end if;
  return new;
end $$;

create trigger recurrences_belong_to_their_document
  before insert or update on public.recurrences
  for each row execute function public.recurrence_matches_document();

-- `updated_at` carries a default and is set by the writer, like every other
-- table here. There is no touch trigger in this schema to reuse, and adding
-- one for a single table would be a second convention.
