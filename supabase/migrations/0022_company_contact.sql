-- How a customer reaches the business (§F, §I).
--
-- Every document the legacy app produced ends in a footer strip — phone,
-- email, website, centred under a hairline — and ours ended in white space.
-- A quotation with no way to reply to it is the one document nobody can act
-- on, and §E's companies row had nowhere to put any of the three: `phone`
-- and `email` existed on CUSTOMERS, never on the business itself.
--
-- All three nullable, and they stay nullable. Rule #1: no new required field,
-- ever. An owner who fills none gets a document with no footer strip rather
-- than a form that will not let them past — the strip prints whichever of the
-- three are there and hides itself when none are.
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists website text;
