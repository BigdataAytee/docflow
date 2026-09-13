-- Giving a brand-new account a company to belong to (§R, §P).
--
-- The other half of the problem 0013 fixed. A real sign-up goes through
-- `auth.signUp`, which sets no custom claims at all — so a new user's token
-- carries no `app_metadata.company_id`, `current_company_id()` is NULL, and
-- every policy denies them everything. They sign up successfully and land in
-- an account that shows nothing.
--
-- They cannot fix it themselves, and should not be able to: creating the
-- company is an INSERT into `public.companies`, whose policy is
-- `with check (id = current_company_id())` — NULL, so refused. That refusal is
-- correct. It just means the first company has to be created by something
-- holding more authority than the client, and this is that something.
--
-- SECURITY DEFINER, unlike `record_payment` and `remember_item`. Those are
-- called by a client that already HAS a company and must stay inside it; this
-- one exists precisely because the caller has none yet, so there is no policy
-- it could satisfy. The authority is bounded instead by what the function will
-- do:
--
--  · it acts only on `auth.uid()` — the caller cannot name another user;
--  · it refuses outright if that user already belongs to a company, so it can
--    never move someone, and a replay returns what is already there;
--  · it takes no company id, so the caller cannot choose to join an existing
--    company. Invitations are a separate, authenticated flow (§W).
--
-- It also stamps `raw_app_meta_data`, which is what puts `company_id` into the
-- NEXT access token. The current token was minted before the company existed
-- and cannot know about it, so the client must refresh its session afterwards
-- — `src/data/supabase/account.ts` does, and says why.

create function public.create_company_for_new_user(
  p_name text,
  p_locale_region text default 'NG',
  p_currency text default 'NGN'
) returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_company public.companies%rowtype;
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'A business needs a name.' using errcode = 'check_violation';
  end if;

  -- Already set up. Returning what exists rather than raising makes a retried
  -- first run harmless (§M) — and a second call can never move a user between
  -- companies, whatever it asks for.
  select company_id into v_existing from public.users where id = v_user;
  if v_existing is not null then
    select * into v_company from public.companies where id = v_existing;
    return jsonb_build_object('company', to_jsonb(v_company), 'created', false);
  end if;

  insert into public.companies (name, locale_region, currency)
  values (btrim(p_name), p_locale_region, p_currency)
  returning * into v_company;

  -- The first user of a company owns it. Every later member arrives through
  -- an invitation, which is a different flow with a different authority.
  insert into public.users (id, company_id, email, role)
  select v_user, v_company.id, u.email, 'owner' from auth.users u where u.id = v_user;

  -- What puts `company_id` into the next token. Merged rather than replaced:
  -- Supabase keeps `provider` and `providers` here and overwriting them would
  -- break the account's own sign-in metadata.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('company_id', v_company.id)
   where id = v_user;

  return jsonb_build_object('company', to_jsonb(v_company), 'created', true);
end $$;

-- `anon` is deliberately NOT granted: a caller with no session has no
-- `auth.uid()`, so the function would refuse anyway, and not granting it means
-- the refusal happens before the function body rather than inside it.
grant execute on function public.create_company_for_new_user(text, text, text) to authenticated;
