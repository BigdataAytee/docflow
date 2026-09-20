-- The payment links a trader pasted in, and the ones one document uses (§J).
--
-- §J's list has always included provider methods — "Bank transfer, Paystack,
-- Flutterwave, cash on delivery, PayPal" — and the only one a customer could
-- actually be told how to use was the bank account. Switching the others on
-- printed a bare name under "Other payment methods" with no address behind
-- it: a line saying "PayPal" and nothing a customer could open.
--
-- JSON, like bank_fields and line_items, because the shape is a LIST whose
-- length is the point: a trader may hold as many as they hold. A column per
-- provider would cap that at however many providers existed the day this ran.
--
-- NOTHING IS CONFIGURED SERVER-SIDE. Each entry is {provider, value} where
-- value is a link the trader already had and pasted — no keys, no tokens, no
-- provider integration, and nothing here that a client is not allowed to
-- write. RLS on both tables is unchanged and still company-scoped.
alter table public.companies
  add column if not exists payment_links jsonb;

-- NULL on every existing row and on almost every new one: absent means "use
-- whatever the business has", which is what nearly every document wants.
-- Only a document that added a method or switched one off for itself carries
-- a list, and an issued one keeps what it was issued with (§M, Rule #5).
alter table public.documents
  add column if not exists payment_links jsonb;
