-- The recipient's own mark, which had nowhere of its own to go (§E, §I, §P).
--
-- `signature_asset_id` sits in this table's §E waybill group, beside
-- `signer_name` and `signed_at` — and the app reads it as the BUSINESS's
-- signature: the one printed at the foot of every document under the
-- localised "DISPATCHED BY" / "AUTHORISED SIGNATURE" caption, copied onto a
-- draft from `companies.default_signature_asset_id`.
--
-- Signing a delivery then wrote the CUSTOMER's drawn mark into that same
-- column. Two consequences, both of them on the printed page:
--
--   · the customer's hand appeared under "DISPATCHED BY" with the business's
--     name beneath it — a delivery note attributing the recipient's signature
--     to the sender;
--   · the "RECEIVED BY" block they had actually signed stayed empty, a
--     heading over a blank rule on every signed delivery there has ever been.
--
-- And it destroyed the business's own mark on that document, because the two
-- meanings shared one column.
--
-- Two marks, two columns. Nullable, because most documents are never signed
-- for (Rule #1), and sealed with the rest of the delivery evidence (§P):
-- written once with the transition to delivered, never edited after.
alter table public.documents
  add column if not exists signer_signature_asset_id uuid references public.assets(id);

-- The signing LINK performs the same act for somebody with no account (§G,
-- §P), so it lands in the same place. This is `apply_public_link` from 0007
-- with one line changed — the parameter list is identical, so this replaces
-- the function rather than overloading it, and the edge function that calls
-- it needs no change.
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
      -- THE RECIPIENT'S column, not the business's. See the header above.
      signer_signature_asset_id =
        coalesce(p_signature_asset_id, signer_signature_asset_id),
      updated_at = now()
  where id = p_document_id;

  -- §P's append-only audit log: who, what, when. "public_link" rather than a
  -- user, because there is no account behind this.
  insert into public.audit_log (company_id, device_id, action, entity, record_id, at)
  select company_id, 'public_link', p_status, 'document', p_document_id, p_consumed_at
  from public.documents where id = p_document_id;
end;
$$;

-- Restated because `create or replace` keeps the old grants only if they were
-- not reset; saying it again costs nothing and cannot be forgotten (§P).
revoke all on function public.apply_public_link from public, anon, authenticated;
