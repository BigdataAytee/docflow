/**
 * The on-device schema (§E, §Q Phase 4).
 *
 * This mirrors the RECORD shapes in `src/data/repositories/types.ts`, not the
 * Postgres migrations column for column. The two databases answer different
 * questions: Postgres is the shared server truth with RLS drawing the company
 * boundary (§P), while this file is one company's working copy on one phone.
 * Transcribing nineteen migrations into SQLite would add columns no screen
 * reads, and Rule #1 says the machinery stays invisible — including to the
 * next person who has to change it.
 *
 * Four rules are enforced by the schema itself rather than by the code above:
 *
 *  · **Money is integer minor units** (Rule #3). Every amount column is
 *    INTEGER, and `strict` tables make that a constraint rather than a habit —
 *    SQLite would otherwise happily store 1500.5 in an INTEGER column.
 *  · **Issued documents are immutable** (Rule #5). A trigger refuses any UPDATE
 *    that changes `issued_reference` or `frozen_labels` once they are set.
 *    The repositories refuse it too; this is the floor under that, because a
 *    future sync applying a server row must hit the same wall (§M: "Sync must
 *    never rewrite them").
 *  · **The outbox commits with the record.** `outbox` is an ordinary table in
 *    this same database, which is the only reason a record write and its
 *    pending upload can share one transaction (CLAUDE.md).
 *  · **Idempotency is a unique index**, not a lookup-then-insert. Two racing
 *    replays of one key cannot both win a UNIQUE constraint; they can both
 *    pass a SELECT.
 *
 * `without rowid` is used where the key is the natural one and rows are read by
 * it — it saves a b-tree per table on a phone with 3GB of RAM.
 */

export const SCHEMA_VERSION = 6

/**
 * Applied in order, inside one transaction, by `migrate`.
 *
 * Append only. A shipped statement is never edited: a device that has already
 * run it would silently diverge from one that had not.
 */
export const MIGRATIONS: readonly string[] = [
  `
  create table if not exists companies (
    id text primary key,
    name text not null,
    locale_region text not null,
    locale_language text not null,
    label_overrides text not null default '{}',
    currency text not null,
    numbering_prefixes text not null default '{}',
    bank_fields text not null default '{}',
    enabled_payment_methods text not null default '[]',
    brand_colour text,
    name_style text,
    logo_size text,
    logo_asset_id text,
    tax_rate_ppm integer,
    wht_rate_ppm integer,
    default_signature_asset_id text,
    signature_required integer,
    version integer not null default 1
  ) strict;

  create table if not exists customers (
    id text primary key,
    company_id text not null,
    kind text not null check (kind in ('company', 'person')),
    name text not null,
    phone text,
    email text,
    address text,
    labels text not null default '[]',
    private_note text,
    version integer not null default 1
  ) strict;

  create index if not exists customers_company_idx on customers (company_id);

  create table if not exists documents (
    id text primary key,
    company_id text not null,
    type text not null,
    status text not null,
    customer_id text,
    currency text not null,
    line_items text not null default '[]',
    issue_date text,
    due_date text,
    valid_until text,
    converted_from_id text,
    payment_id text,
    linked_invoice_id text,
    supersedes_id text,
    signature_asset_id text,
    delivery_address text,
    driver_name text,
    vehicle_number text,
    dispatch_date text,
    signer_name text,
    signer_role text,
    signed_at text,
    delivery_photo_asset_id text,
    issued_reference text,
    frozen_labels text,
    total_minor integer not null,
    version integer not null default 1
  ) strict;

  create index if not exists documents_company_type_idx on documents (company_id, type);

  -- No company_id. A payment is scoped by the customer it belongs to, exactly
  -- as the in-memory store scopes it: the ledger type carries no company of
  -- its own, and a denormalised copy here would be a second place for the
  -- answer to disagree with itself.
  create table if not exists payments (
    id text primary key,
    customer_id text not null,
    currency text not null,
    amount_minor integer not null,
    paid_at text not null,
    method text not null,
    source text not null,
    reference text,
    external_event_id text,
    reversal_of_id text,
    version integer not null default 1
  ) strict;

  create index if not exists payments_customer_idx on payments (customer_id);

  create table if not exists payment_allocations (
    id text primary key,
    payment_id text not null,
    invoice_id text not null,
    currency text not null,
    amount_minor integer not null,
    position integer not null
  ) strict;

  create index if not exists allocations_payment_idx on payment_allocations (payment_id);
  create index if not exists allocations_invoice_idx on payment_allocations (invoice_id);

  create table if not exists items (
    id text primary key,
    company_id text not null,
    name text not null,
    last_price_currency text,
    last_price_minor integer,
    unit text,
    times_used integer not null default 0,
    version integer not null default 1
  ) strict;

  create index if not exists items_company_idx on items (company_id);

  create table if not exists expenses (
    id text primary key,
    company_id text not null,
    description text not null,
    category text,
    currency text not null,
    amount_minor integer not null,
    spent_on text not null,
    photo_asset_id text,
    version integer not null default 1
  ) strict;

  create index if not exists expenses_company_idx on expenses (company_id);

  create table if not exists credit_notes (
    id text primary key,
    company_id text not null,
    invoice_id text not null,
    currency text not null,
    amount_minor integer not null,
    reason text not null,
    issued_at text not null,
    reference text not null,
    invoice_reference text not null,
    invoice_total_currency text not null,
    invoice_total_minor integer not null,
    version integer not null default 1
  ) strict;

  create index if not exists credits_company_idx on credit_notes (company_id);
  create index if not exists credits_invoice_idx on credit_notes (invoice_id);

  -- §E's audit_log shape, not a table invented for sharing: action, entity,
  -- record_id, at, device. There is no recipient column and no "delivered"
  -- action, because neither is a thing this device can know (§M).
  create table if not exists share_events (
    id text primary key,
    company_id text not null,
    action text not null,
    entity text not null,
    record_id text not null,
    at text not null,
    device_id text,
    actor_id text,
    channel text not null
  ) strict;

  create index if not exists shares_company_idx on share_events (company_id);
  create index if not exists shares_record_idx on share_events (record_id);

  create table if not exists assets (
    id text primary key,
    company_id text not null,
    kind text not null,
    data_url text not null,
    created_at text not null
  ) strict;

  create index if not exists assets_company_idx on assets (company_id);

  create table if not exists link_tokens (
    document_id text primary key,
    company_id text not null,
    token_hash text not null,
    expires_at text not null,
    consumed_at text
  ) strict, without rowid;

  create table if not exists account_deletion (
    company_id text primary key,
    request text not null
  ) strict, without rowid;

  create table if not exists outbox (
    id text primary key,
    entity text not null,
    record_id text not null,
    kind text not null,
    payload text not null,
    idempotency_key text not null,
    base_version integer not null,
    actor_id text not null,
    device_id text not null,
    created_at text not null,
    depends_on text,
    state text not null default 'pending',
    attempts integer not null default 0,
    next_attempt_at text,
    last_error text,
    sequence integer not null
  ) strict;

  create unique index if not exists outbox_key_idx on outbox (idempotency_key);
  create index if not exists outbox_state_idx on outbox (state, sequence);

  create table if not exists mutation_log (
    idempotency_key text primary key,
    entity text not null,
    record_id text not null
  ) strict, without rowid;

  create table if not exists sync_state (
    key text primary key,
    value text not null
  ) strict, without rowid;
  `,

  `
  create trigger if not exists documents_reference_is_frozen
  before update of issued_reference on documents
  when old.issued_reference is not null and new.issued_reference is not old.issued_reference
  begin
    select raise(abort, 'An issued reference is frozen at issue (v6 Rule #5).');
  end;

  create trigger if not exists documents_labels_are_frozen
  before update of frozen_labels on documents
  when old.frozen_labels is not null and new.frozen_labels is not old.frozen_labels
  begin
    select raise(abort, 'Frozen labels are fixed at issue (v6 Rule #5).');
  end;

  create trigger if not exists documents_evidence_is_sealed
  before update of signer_name on documents
  when old.signed_at is not null and new.signer_name is not old.signer_name
  begin
    select raise(abort, 'Delivery evidence is sealed once signed (v6 P).');
  end;
  `,

  `
  -- How a document looks, kept WITH the document (§H).
  --
  -- Four columns rather than one JSON blob: each is a scalar the page reads
  -- directly, and a blob would need parsing before anything could be trusted
  -- to be a template id. Adding a column is the one alteration SQLite
  -- performs without rewriting the table, and a null in any of them
  -- means "whatever the app defaults to" — which is what every existing row
  -- already meant.
  alter table documents add column template_id text;
  alter table documents add column show_logo integer;
  alter table documents add column brand_colour text;
  alter table documents add column discount_rate_ppm integer;
  `,

  `
  -- Monthly repeats (§L4).
  --
  -- Keyed by the document it repeats, because one invoice has one schedule:
  -- switching Repeat on twice is the same schedule, not two, and a primary
  -- key says so at the level where it cannot be got wrong.
  --
  -- An end DATE rather than a delete: the drafts already made stand, and a
  -- row that vanishes makes "why did this stop?" unanswerable.
  create table if not exists recurrences (
    source_document_id text primary key,
    company_id text not null,
    day_of_month integer not null,
    started_on text not null,
    ended_on text
  ) strict, without rowid;

  create index if not exists recurrences_company_idx on recurrences (company_id);

  -- Which period a draft was created FOR. This is what makes catch-up
  -- idempotent across a crash: the keys already on the device are read off
  -- the documents themselves, so a run that died halfway finds its own
  -- earlier drafts and creates only what is still missing.
  alter table documents add column recurrence_key text;

  -- One draft per period, enforced by the database rather than by the code
  -- that remembers to check. A partial index, so the column stays null on
  -- every document somebody made themselves without colliding with itself.
  create unique index if not exists documents_recurrence_key_idx
    on documents (recurrence_key) where recurrence_key is not null;
  `,

  `
  -- When the goods should ARRIVE (§E expected_delivery_date).
  --
  -- The hosted schema has had this since 0002 and §E lists it in the waybill
  -- field group; only the on-device store, the draft and the screen were
  -- missing it, so the date a recipient cares about most could not be set.
  -- Dispatch is when it leaves; this is when it should land.
  alter table documents add column expected_date text;
  `,

  `
  -- The business's own address (§F, §R).
  --
  -- Not a new required field (Rule #1): a null address prints nothing and
  -- blocks nothing. It exists because the Company panel has asked for one
  -- since the prototype and had nowhere to put it, and because §R sets it up
  -- with "the same fields and validation as Settings".
  alter table companies add column address text;
  `,
]

/**
 * The one PRAGMA set that matters on a phone, and why each is here.
 *
 * Run OUTSIDE a transaction (`journal_mode` refuses one) and before any
 * migration, so the first write already lands in a WAL.
 */
export const PRAGMAS: readonly string[] = [
  // A reader never blocks a writer. The list screens read while the outbox
  // drains; with the rollback journal one of them waits, and the one that
  // waits is whichever the owner is looking at.
  'pragma journal_mode = WAL',
  // WAL + NORMAL loses at most the last transaction to a power cut, never the
  // database. FULL costs an fsync per commit, which on a cheap phone's eMMC is
  // the difference between a save that feels instant and one that does not.
  'pragma synchronous = NORMAL',
  'pragma foreign_keys = ON',
  // Nothing here is a hot loop; a smaller cache leaves headroom for the model
  // tier (§N) on a 3GB device.
  'pragma cache_size = -4000',
]
