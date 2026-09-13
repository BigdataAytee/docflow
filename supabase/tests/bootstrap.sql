-- Roles that a hosted Supabase project provides and a bare Postgres does not.
-- CI-only: this file is NEVER applied to a real project — it exists so the
-- production migrations run unmodified against a plain postgres container.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- Mirrors Supabase: service_role bypasses RLS, which is exactly why the
  -- client is never given it (CLAUDE.md).
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- The `auth` schema a hosted project provides. CI-only, like the roles above:
-- the production migrations reference `auth.users` and `auth.uid()`, so a bare
-- Postgres needs enough of both for those migrations to run UNMODIFIED. What
-- is mirrored here is only the shape the migrations actually touch.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  -- Supabase puts this in the JWT as the `app_metadata` claim. It is the
  -- thing `current_company_id()` reads, so the tests must have it.
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
  language sql stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', ''
  )::uuid
$$;

-- The grants a hosted project carries. `authenticated` and `anon` get USAGE on
-- the schema so `auth.uid()` resolves, and NOT select on `auth.users` — a
-- signed-in client cannot read the auth table, which is exactly why
-- `create_company_for_new_user` has to be SECURITY DEFINER to read its own
-- caller's email. `service_role` gets the table, as it does in production.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant all on auth.users to service_role;
