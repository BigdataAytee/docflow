-- DocFlow §P/§Q — the public accept and sign links, and the schema the app
-- has grown since Phase 1.
--
-- The edge function is the first thing in this build to READ the database
-- rather than the repository contracts, which is how these gaps surfaced:
-- three app-side fields had no column, and `assets` was designed for uploaded
-- files before signatures turned out to be vectors small enough to inline.

-- §G's "duplicate as Rev 2", and a reissued receipt. The link lives on the
-- NEW document; the original is never altered (§G, Rule #5).
alter table public.documents
  add column if not exists supersedes_id uuid references public.documents(id);

create index if not exists documents_supersedes_id_idx
  on public.documents (supersedes_id);

-- A drawn signature is an SVG path of a few hundred bytes and a shrunk
-- delivery photo is tens of kilobytes, so both are stored inline rather than
-- as a file to fetch — §M: nothing needed to open a saved document touches a
-- CDN. The upload columns stay for assets that are genuinely files.
alter table public.assets
  add column if not exists kind text
    check (kind in ('signature', 'delivery_photo', 'expense_photo', 'logo')),
  add column if not exists data_url text;

-- §P: "delivered/signed links cannot be reused to alter evidence."
--
-- One function, because the evidence and the token's death must land together
-- or not at all. Two statements from the edge function could leave a signed
-- document with a live link, which is the one thing §P forbids.
--
-- SECURITY DEFINER so it runs above RLS: the caller is a customer with no
-- account. `search_path` is pinned, so a planted function in another schema
-- cannot be reached from inside this one.
create or replace function public.apply_public_link(
  p_document_id uuid,
  p_status text,
  p_signer_name text,
  p_signer_role text,
  p_signed_at timestamptz,
  p_signature_asset_id uuid,
  p_token_hash text,
  p_consumed_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current text;
  v_type text;
begin
  -- Lock the document for the length of the transaction, so two customers
  -- pressing sign at the same moment cannot both pass the checks below.
  select status, type into v_current, v_type
  from public.documents
  where id = p_document_id
  for update;

  if v_current is null then
    raise exception 'no such document';
  end if;

  -- The lifecycle, restated where the server can enforce it (§P: "the server
  -- revalidates against this same table and rejects invalid transitions").
  if v_type = 'quotation' then
    if v_current not in ('issued', 'sent') or p_status not in ('accepted', 'rejected') then
      raise exception 'not answerable';
    end if;
  elsif v_type = 'waybill' then
    if v_current not in ('dispatched', 'in_transit') or p_status <> 'delivered' then
      raise exception 'not answerable';
    end if;
    -- A mark with nobody behind it is not evidence, and a name with no mark
    -- is not a signature (§P).
    if p_signer_name is null or p_signature_asset_id is null then
      raise exception 'incomplete evidence';
    end if;
  else
    raise exception 'not answerable';
  end if;

  -- The token dies here, in the same transaction, and only if it was still
  -- alive. A second press finds nothing to consume and the whole thing rolls
  -- back rather than signing twice.
  update public.document_signing_tokens
  set consumed_at = p_consumed_at
  where token_hash = p_token_hash
    and document_id = p_document_id
    and consumed_at is null
    and expires_at > p_consumed_at;

  if not found then
    raise exception 'link already used or expired';
  end if;

  update public.documents
  set status = p_status,
      signer_name = coalesce(p_signer_name, signer_name),
      signer_role = coalesce(p_signer_role, signer_role),
      signed_at = coalesce(p_signed_at, signed_at),
      signature_asset_id = coalesce(p_signature_asset_id, signature_asset_id),
      updated_at = now()
  where id = p_document_id;

  -- §P's append-only audit log: who, what, when. "public_link" rather than a
  -- user, because there is no account behind this.
  insert into public.audit_log (company_id, device_id, action, entity, record_id, at)
  select company_id, 'public_link', p_status, 'document', p_document_id, p_consumed_at
  from public.documents where id = p_document_id;
end;
$$;

-- Nobody may call this with an anon or authenticated key: the edge function
-- holds service role, and it is the only caller (§P).
revoke all on function public.apply_public_link from public, anon, authenticated;
