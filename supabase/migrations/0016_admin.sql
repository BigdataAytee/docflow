-- Admin: server-enforced permissions, an activity feed, and device revoke
-- (§Q Phase 7, §P).
--
-- §P: "Staff permissions enforced **server-side**; scripted penetration
-- checks run as wrong user, wrong role and revoked device."
--
-- The word doing the work is server-side. A permission checked only in the UI
-- is a suggestion: the same account, the same token, and `curl` does whatever
-- it likes. So every rule here is a POLICY — the client can hide a button, but
-- hiding it is decoration on top of a refusal that already exists.
--
-- `users.role` and `users.permissions` have been in the schema since 0001 and
-- nothing has ever read them. This is what reads them.

-- ------------------------------------------------------------------ helpers
--
-- SECURITY DEFINER for the same reason `current_company_id` is not: these read
-- `public.users`, whose own policy calls `current_company_id()`, so an INVOKER
-- function would recurse. Owned by the migration role and pinned, they answer
-- exactly two questions about the CALLER and nothing about anybody else.

create function public.current_user_role() returns text
  language sql stable security definer
  set search_path = public, auth, pg_temp
as $$
  select u.role from public.users u where u.id = auth.uid()
$$;

create function public.current_user_can(p_permission text) returns boolean
  language sql stable security definer
  set search_path = public, auth, pg_temp
as $$
  select coalesce(
    -- An owner can do everything. There is no permission an owner can be
    -- missing, so no way to lock the last owner out of their own company.
    (select u.role = 'owner' from public.users u where u.id = auth.uid()),
    false
  ) or coalesce(
    (select (u.permissions ->> p_permission)::boolean
       from public.users u where u.id = auth.uid()),
    false
  )
$$;

grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.current_user_can(text) to authenticated, service_role;

-- ------------------------------------------------------------------ devices
--
-- §Q Phase 7: "device revoke", and the gate: "a revoked device cannot sync".
--
-- A device is a row, and revoking it is a timestamp rather than a delete: §M
-- says a credential problem never destroys local work, and an audit log that
-- loses the device it is about answers fewer questions than it was kept for.
create table public.devices (
  id text not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  label text,
  last_seen_at timestamptz,
  -- Null means live. A time means revoked at that moment, and it stays.
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (company_id, id)
);

alter table public.devices enable row level security;
alter table public.devices force row level security;
grant select, insert, update, delete on public.devices to authenticated;
grant all on public.devices to service_role;

create index devices_company_idx on public.devices (company_id);

-- Anyone in the company may SEE the devices: an activity feed that hides
-- which devices exist cannot be audited by the person it is for.
create policy devices_read on public.devices
  for select to authenticated
  using (company_id = public.current_company_id());

-- Registering the device you are on. Scoped to the caller, so nobody can
-- enrol a device into someone else's name.
create policy devices_enrol on public.devices
  for insert to authenticated
  with check (company_id = public.current_company_id() and user_id = auth.uid());

-- REVOKING is the privileged half, and the policy is the enforcement. A staff
-- account that could revoke devices could revoke the owner's.
create policy devices_manage on public.devices
  for update to authenticated
  using (company_id = public.current_company_id() and public.current_user_can('manage_devices'))
  with check (company_id = public.current_company_id());

-- -------------------------------------------------------------- staff admin
--
-- Who may change a colleague's role or permissions. Not the colleague — and
-- not, as it turns out, by adding a policy.
--
-- `public.users` already carries the blanket `company_isolation` policy from
-- 0006 (`for all … using company_id = current_company_id()`). RLS policies are
-- PERMISSIVE and OR'd together, so a second, stricter policy grants nothing
-- and forbids nothing: the blanket one still says yes. Until this migration,
-- **any staff member could promote themselves to owner** with one UPDATE —
-- §P's "staff permissions enforced server-side" defeated by the very policy
-- that draws the company boundary. Found by testing it rather than reading it.
--
-- A policy cannot express the rule either way, because the rule is about the
-- DIFFERENCE between the old row and the new one: `USING` sees the old,
-- `WITH CHECK` sees the new, and neither sees both. A trigger does, which is
-- why the guard is a trigger and not more policy.
--
-- Scoped to the two privileged columns, so everything else about a person's
-- own row — their display name, their language — stays self-service (§S).

-- SECURITY INVOKER, deliberately, and it matters: inside a DEFINER function
-- `current_user` is the function's OWNER, not the caller, so the service_role
-- exemption below would never fire and every server-side staff change would be
-- refused. The privileged read it needs is already inside
-- `current_user_can`, which is DEFINER for its own reason (recursion).
create function public.guard_user_privileges() returns trigger
  language plpgsql security invoker
  set search_path = public, auth, pg_temp
as $$
begin
  -- service_role is the trusted side of the boundary by construction: it is
  -- the key that must never reach a browser, and the edge functions that hold
  -- it provision accounts and staff. Guarding it here would block legitimate
  -- server-side administration while protecting nothing — a leaked service key
  -- is already total, which is what the Phase 7 penetration checks are for.
  if current_user = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.permissions is distinct from old.permissions then
    if not public.current_user_can('manage_staff') then
      raise exception 'You do not have permission to change staff roles.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

create trigger users_privilege_guard
  before update on public.users
  for each row execute function public.guard_user_privileges();

-- ------------------------------------------------------- the activity feed
--
-- §Q Phase 7: "activity feed". It is a read over the append-only audit log,
-- which already refuses updates and deletes (0006). Nothing new is stored —
-- a feed that kept its own copy would be a second version of the truth.
create view public.activity_feed as
  select a.id, a.company_id, a.user_id, a.device_id, a.action, a.entity,
         a.record_id, a.at, u.display_name, u.email,
         (d.revoked_at is not null) as device_revoked
    from public.audit_log a
    left join public.users u on u.id = a.user_id
    left join public.devices d on d.company_id = a.company_id and d.id = a.device_id;

-- The view runs with the CALLER's rights, so `audit_log`'s own policy still
-- scopes it. Without this a view owned by the migration role would hand every
-- company's activity to every caller — the classic way a view leaks past RLS.
alter view public.activity_feed set (security_invoker = on);
grant select on public.activity_feed to authenticated;
