-- Deleting an account (§S, §V, Rule #6; Apple App Review Guideline 5.1.1(v)).
--
-- Found by the store-policy pass: DocFlow offers account creation and offered
-- no way out, which Apple's rule makes a submission blocker rather than a
-- nicety. The rule, read 2026-09-14 and quoted in the questionnaire, is that
-- the ENTIRE account record and the personal data with it must go, and that
-- "only offering to temporarily deactivate or disable an account is
-- insufficient" — while a process that takes time is fine, provided the
-- person is told how long and gets a confirmation.
--
-- So: scheduled, with a thirty-day window that belongs to the person leaving.
-- No new read path is created for anybody during it. There is no
-- administrator's copy, and this file is the wrong place to add one — see
-- `src/domain/account/deletion.ts` for why at length.
--
-- The purge itself is one DELETE, because every company-scoped table in this
-- schema references `companies(id) ON DELETE CASCADE`. That is not a lucky
-- accident to rely on quietly: `deletion.sql.test.ts` reads these migrations
-- and fails if a company-scoped table is ever added without the cascade, so
-- the purge stays complete by construction rather than by a list somebody
-- remembers to extend.

-- ------------------------------------------------------------- the request
create table public.account_deletions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  -- Nothing is destroyed before this instant. The column is the promise.
  purge_after timestamptz not null,
  -- Whether the owner took the archive on the way out. Recorded, never
  -- required: Rule #6 says export is free forever, not that leaving is
  -- conditional on it.
  exported boolean not null default false
);

alter table public.account_deletions enable row level security;
alter table public.account_deletions force row level security;
grant select on public.account_deletions to authenticated;
grant all on public.account_deletions to service_role;

-- Everyone in the company may SEE that the company is scheduled for deletion.
-- Staff finding out when the data vanishes would be worse than useless.
create policy account_deletions_read on public.account_deletions
  for select to authenticated
  using (company_id = public.current_company_id());

-- No insert, update or delete policy at all. Both directions go through the
-- functions below, which check the caller's ROLE; a policy cannot, because
-- the rule is about who the caller is rather than which row they touch.

-- ------------------------------------------------------------ the tombstone
--
-- What is left afterwards: ids and dates. No name, no email, no document, no
-- amount. Enough to answer "was this account deleted, and when" a year later
-- without having kept the account.
create table public.deleted_accounts (
  company_id uuid primary key,
  requested_by uuid,
  requested_at timestamptz not null,
  purged_at timestamptz not null default now()
);

alter table public.deleted_accounts enable row level security;
alter table public.deleted_accounts force row level security;
-- No grant to `authenticated` and no policy: nobody reads this with a user
-- token. FORCE means the owner of the table is subject to its policies too,
-- so a leaked anon or service key is the only way in and that is Phase 7c's
-- problem, not this table's.
grant all on public.deleted_accounts to service_role;

-- ----------------------------------------------------------------- request
--
-- SECURITY DEFINER because it must read `public.users` for the caller's role
-- and write a table with no insert policy. It answers exactly one question
-- about exactly one caller.
create function public.request_account_deletion(
  p_typed_name text,
  p_exported boolean default false
) returns public.account_deletions
  language plpgsql volatile security definer
  set search_path = public, auth, pg_temp
as $$
declare
  v_company uuid := public.current_company_id();
  v_name text;
  v_row public.account_deletions;
begin
  if v_company is null then
    raise exception 'no company in claims' using errcode = '42501';
  end if;

  -- Owner only, and no permission promotes anybody into it. An admin who can
  -- delete the company can end the business's records in an afternoon.
  if public.current_user_role() is distinct from 'owner' then
    raise exception 'only the owner may delete the account' using errcode = '42501';
  end if;

  select c.name into v_name from public.companies c where c.id = v_company;

  -- The business name, typed. Not a checkbox and not the word DELETE: the
  -- name is different for every company and cannot come from muscle memory.
  -- An unnamed company cannot be confirmed by typing nothing.
  if coalesce(btrim(v_name), '') = '' or lower(btrim(p_typed_name)) is distinct from lower(btrim(v_name)) then
    raise exception 'the business name does not match' using errcode = '22023';
  end if;

  insert into public.account_deletions (company_id, requested_by, purge_after, exported)
  values (v_company, auth.uid(), now() + interval '30 days', coalesce(p_exported, false))
  -- Asking twice is not an error, and must not extend the window: a second
  -- request that reset the clock would be a way to keep an account alive
  -- forever by asking to delete it every month.
  on conflict (company_id) do update set exported = public.account_deletions.exported or excluded.exported
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.request_account_deletion(text, boolean) from public;
grant execute on function public.request_account_deletion(text, boolean) to authenticated;

-- ------------------------------------------------------------------ cancel
--
-- One call, no typed name. Asymmetric on purpose: the destructive direction
-- is slow and deliberate, the recovering direction is immediate. Anything
-- else punishes the mistake the window exists to catch.
create function public.cancel_account_deletion() returns void
  language plpgsql volatile security definer
  set search_path = public, auth, pg_temp
as $$
declare
  v_company uuid := public.current_company_id();
begin
  if v_company is null then
    raise exception 'no company in claims' using errcode = '42501';
  end if;
  if public.current_user_role() is distinct from 'owner' then
    raise exception 'only the owner may cancel the deletion' using errcode = '42501';
  end if;

  delete from public.account_deletions where company_id = v_company;
end;
$$;

revoke all on function public.cancel_account_deletion() from public;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ------------------------------------------------------------------- purge
--
-- Service-role only, for a scheduled job. Never reachable with a user token:
-- a function that deletes a company must not be callable by the company.
create function public.purge_due_accounts() returns integer
  language plpgsql volatile security definer
  set search_path = public, auth, pg_temp
as $$
declare
  v_row public.account_deletions;
  v_count integer := 0;
begin
  for v_row in
    select * from public.account_deletions where purge_after <= now()
  loop
    -- The tombstone FIRST. If the delete below fails half way, the record of
    -- what was asked for survives; the other order loses it.
    insert into public.deleted_accounts (company_id, requested_by, requested_at)
    values (v_row.company_id, v_row.requested_by, v_row.requested_at)
    on conflict (company_id) do nothing;

    -- The sign-in itself. Apple 5.1.1(v) is about the ACCOUNT record, not
    -- only the business data, so the auth users go with the company —
    -- otherwise the person can still sign in to nothing.
    delete from auth.users u
     where u.id in (select id from public.users where company_id = v_row.company_id);

    -- Every company-scoped table cascades from this one row.
    delete from public.companies where id = v_row.company_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.purge_due_accounts() from public, authenticated, anon;
grant execute on function public.purge_due_accounts() to service_role;

comment on function public.purge_due_accounts() is
  'Runs from a scheduled job with the service role. Deletes companies whose '
  'grace window has closed, leaving only a tombstone of ids and dates.';
