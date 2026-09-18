-- A picture of the goods, on the line item (§E, §G step 2, §I).
--
-- §E has listed "image asset id" among a line item's fields since the spec was
-- written, §G step 2 asks for "a card with optional photo" and §I for "a
-- thumbnail if a photo was attached". Nothing could attach one, because the
-- line item had no such field and `assets.kind` had no such value.
--
-- NO COLUMN IS ADDED FOR THE LINE ITEM ITSELF. Line items are stored as JSON
-- on both sides, so the id rides along inside `documents.line_items` and old
-- rows simply have no photo. What needs changing is the kind a photo can be
-- stored under: the check constraint would refuse it.
--
-- The constraint is dropped and rebuilt rather than widened in place, because
-- Postgres has no "alter check". Its name is the one Postgres generated when
-- 0007 added the column without naming it; `if exists` makes this safe on a
-- database where that add was a no-op.
alter table public.assets
  drop constraint if exists assets_kind_check;

alter table public.assets
  add constraint assets_kind_check
    check (kind in ('signature', 'delivery_photo', 'expense_photo', 'logo', 'item_photo'));
