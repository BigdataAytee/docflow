-- DocFlow §E — the columns the app grew that the schema had not.
--
-- Found by writing the Supabase repositories: mapping every app field to a
-- column is the first thing that has ever compared the two lists. Three were
-- missing, and one of them was already being SELECTed by shipped code.

-- §E's waybill "delivery address". The builder has collected it since the
-- delivery document was built, and `public-link`'s edge function SELECTs it
-- by name — so the public signing page would have failed on every request the
-- first time it ran. Nothing had connected the app to the real schema before
-- now, which is exactly the gap this migration closes.
alter table public.documents
  add column if not exists delivery_address text;

-- §G's "Default signature — signs new documents unless you draw a different
-- one", and §G's signature requirement validated at issue.
--
-- `default_signature_asset_id` is nullable and MEANS something when null: the
-- owner removed it. A patch that cannot express "removed" would let sync
-- restore a default nobody wanted (§M) — the same reason the app types it
-- `string | null` rather than optional.
alter table public.companies
  add column if not exists default_signature_asset_id uuid references public.assets(id)
    on delete set null,
  add column if not exists signature_required boolean not null default false;
