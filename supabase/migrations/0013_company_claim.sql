-- The company claim, as Supabase actually issues it (§P).
--
-- `current_company_id()` read `claims ->> 'company_id'` — a TOP-LEVEL claim.
-- A real Supabase access token does not have one. Custom claims set through
-- the admin API or an auth hook arrive NESTED:
--
--   { "sub": "...", "role": "authenticated",
--     "app_metadata": { "provider": "email", "company_id": "..." } }
--
-- So in production the function returned NULL for every signed-in user, every
-- policy denied everything, and the app would have signed people in
-- successfully and then shown them an empty account — on every screen, with no
-- error anywhere. The whole §P design was inert.
--
-- Nothing caught it because `supabase/tests/apply.ts` set the claims GUC to a
-- flat `{"company_id": ...}` object by hand. The suite proved the policies
-- were right about a claims shape that does not exist. The harness is
-- corrected in the same change as this function; a fix to either alone would
-- leave the pair still agreeing with each other and still wrong.
--
-- Both shapes are read, nested first:
--  · nested is what Supabase issues to a signed-in user;
--  · flat is what the `public-link` edge function sets on its own connection,
--    and what a project using a custom access-token hook may emit.
-- Reading both costs nothing and means neither caller has to know about the
-- other.

create or replace function public.current_company_id() returns uuid
  language sql stable
as $$
  -- The inner nullif still matters: an empty claims GUC cast straight to json
  -- raises, so an unauthenticated caller would get an error rather than an
  -- empty result. Guard before the cast, then read nested, then flat.
  select coalesce(
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::json
        -> 'app_metadata' ->> 'company_id',
      ''
    )::uuid,
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'company_id',
      ''
    )::uuid
  )
$$;

comment on function public.current_company_id() is
  'The caller''s company, from the JWT — app_metadata.company_id as Supabase issues it, or a top-level company_id. NULL when unauthenticated, and every policy then denies.';
