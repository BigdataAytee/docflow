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
