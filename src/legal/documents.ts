/**
 * The privacy policy, the terms, and the storage note — BUILT FROM
 * `inventory.ts` rather than from a template (§P, §T).
 *
 * A generated policy has one property a written one does not: adding a field
 * to the app and forgetting the policy becomes impossible, because the policy
 * is a function of the field list. `legal.test.ts` asserts the direction —
 * every data category has to appear in the privacy text — so the failure mode
 * is a red test rather than a quiet inaccuracy.
 *
 * WHAT IS NOT CLAIMED, and this is a rule rather than a style: no
 * certification, no "GDPR compliant", no "bank-level security", no
 * "military-grade". The app encrypts its local database and forces row-level
 * security, and those are the two things it says, in the words of what they
 * do. A badge is a claim somebody has to defend.
 *
 * ENGLISH ONLY, on purpose. §S's rule is that absent beats a bad translation,
 * and it bites hardest here: a machine-translated limitation-of-liability
 * clause is a legal document nobody has read. The other languages wait for a
 * translator, the same way the marketing copy does.
 */

import {
  DATA_CATEGORIES,
  DEVICE_PERMISSIONS,
  NOT_COLLECTED,
  PROCESSORS,
  STORAGE_KEYS,
} from './inventory'

export interface LegalDocument {
  readonly id: 'privacy' | 'terms' | 'storage'
  readonly slug: string
  readonly title: string
  /** Markdown-ish: `##` headings, blank-line-separated paragraphs, `-` lists. */
  readonly body: string
}

const BASIS: Readonly<Record<string, string>> = {
  contract: 'to provide the service you signed up for',
  legitimate_interest: 'for the legitimate interest of running your business',
  legal_obligation: 'to meet a legal obligation',
  consent: 'with your consent',
}

const bullets = (lines: readonly string[]): string => lines.map((line) => `- ${line}`).join('\n')

/* ------------------------------------------------------------- privacy */

function privacyBody(): string {
  const collected = DATA_CATEGORIES.map((category) => {
    const where =
      category.storedIn.length === 2
        ? 'on your device and in your account'
        : category.storedIn[0] === 'device'
          ? 'on your device only'
          : 'in your account'
    const optional = category.optional ? ' You can leave this empty.' : ''
    return `**${category.what}** — ${category.why}. Kept ${where}, ${BASIS[category.basis]}.${optional}`
  })

  const processors = PROCESSORS.map(
    (p) => `**${p.name}** (${p.role}) — ${p.sees}. Located: ${p.where}.`,
  )

  const permissions = DEVICE_PERMISSIONS.map(
    (p) => `**${p.name}** — ${p.askedWhen}. If you say no: ${p.ifRefused}.`,
  )

  return `Last updated: [[EFFECTIVE_DATE]]

DocFlow is made by [[LEGAL_ENTITY_NAME]], [[REGISTERED_ADDRESS]]. If you want
to ask anything here, or exercise any of the rights below, write to
[[SUPPORT_EMAIL]].

## The short version

DocFlow is a tool for making invoices, quotations, receipts and delivery
notes. Your records are yours. They are kept on your device first and work
with no internet at all; if you have an account, they also sync so you can
open them on another phone or on the web.

We do not sell or share your information with anybody, we run no advertising,
and we do not track what you do in the app.

## What we collect, and why

${bullets(collected)}

## What we do not collect

${bullets(NOT_COLLECTED)}

## Who else sees it

${bullets(processors)}

## Information about your customers

Most of what DocFlow holds is not about you — it is the names, addresses and
delivery details of the people you sell to, which you enter yourself. For
that information you are the controller and we are the processor: you decide
what goes in, and you are the person your customer would ask about it. We act
on your instructions, and on nobody else's.

If one of your customers asks you to delete what you hold about them, you can
do it in the app, and it is removed from your account when it next syncs.

## Device permissions

${bullets(permissions)}

Each is asked for at the moment you first use the feature, never at startup,
and refusing one leaves the rest of the app working.

## How long we keep it

Your records stay until you delete them. Deleting a document removes it;
deleting your business removes everything belonging to it.

When you ask us to delete your business we schedule it, show you the date,
and let you cancel until then — because an account ended by a slipped thumb
is a business's records gone. After that date the records are deleted from
the live database. Backups age out on their own cycle and are not rewritten;
they are not used to restore a deleted account.

## Your rights

You can ask for a copy of your information, correct it, delete it, object to
how it is used, or ask us to send it somewhere else. Two of those do not need
to involve us at all:

- **Export** is in the app, on every plan, free, forever — Settings → Data &
  sync → Export all my data. A lapsed subscription never locks it.
- **Deletion** is in the app — Settings → Delete this business.

For anything else, write to [[SUPPORT_EMAIL]]. We will answer within one
month. If you are in the UK or the EU and are not satisfied, you can complain
to your national data protection authority.

## Where your information is

If you use DocFlow without an account, your records never leave your device.

With an account they are stored by Supabase in [[SUPABASE_REGION]]. Where
that is outside your own country, the transfer relies on the standard
contractual clauses in our agreement with them.

## Security

Records on your device are held in an encrypted database, with the key kept in
the operating system's own secure storage rather than in the app. In your
account, every table enforces row-level security, so one business's rows
cannot be read by another's sign-in.

No system is perfectly secure, and we do not claim otherwise.

## Children

DocFlow is a tool for running a business and is not directed at children. We
do not knowingly collect information from anyone under 16. If you believe a
child has created an account, write to [[SUPPORT_EMAIL]] and we will remove it.

## Changes

If this policy changes in a way that affects you, we will say so in the app
before it takes effect, rather than only changing the date at the top.`
}

/* --------------------------------------------------------------- terms */

function termsBody(): string {
  return `Last updated: [[EFFECTIVE_DATE]]

These terms are between you and [[LEGAL_ENTITY_NAME]], [[REGISTERED_ADDRESS]].
Using DocFlow means accepting them.

## What DocFlow is

A tool for making and keeping business documents. It does not give you legal,
tax or accounting advice. The tax rates and bank field sets it suggests are
starting points for you to check, not advice about what you owe — you are
responsible for what your documents say.

## Your account

You need an account to sync between devices; you do not need one to use the
app on a single device. Keep your password to yourself, and tell us at
[[SUPPORT_EMAIL]] if you think somebody else has it.

You must be at least 16 to hold an account, and you must be acting for a
business rather than as a consumer buying for personal use.

## Your records are yours

You keep every right in the documents, customer details and logos you put
into DocFlow. You give us permission to store and process them only so far as
running the service requires — hosting them, syncing them between your
devices, and serving a document to somebody you sent a link to.

We do not use your records to train anything, and we do not sell them.

## What you may not do

${bullets([
  'Use DocFlow to send anything unlawful, or to invoice for something you are not entitled to invoice for',
  'Try to reach another business’s records, or probe the service for a way to',
  'Automate the app to make more requests than a person plausibly would, or get around a limit, a quota or a block',
  'Resell access, or run the service for somebody else as if it were yours',
])}

## Fair use, and what we may do about it

The service applies rate limits and usage limits, and refuses requests over
them. They exist to keep it working for everybody and to stop one account
running up a cost that falls on everyone else. We may change them, and may
suspend an account that is deliberately working around them — with notice
wherever we reasonably can.

## Paying

DocFlow has a free tier that makes documents without limit. Pro adds
[[PRO_PRICE]], billed by Apple or Google through your device's own
subscription system.

- The price you see at purchase is the total. There are no fees on top.
- It renews automatically at the same interval until you cancel.
- **You cancel in the store, not here** — Settings → your Apple ID or Google
  Play → Subscriptions. We cannot cancel it for you, and anybody who tells you
  otherwise is wrong about how store billing works.
- Cancelling stops the next renewal and leaves the current period running.

Refunds are handled by whichever store took the payment, under their own
policy — we have no ability to refund a store purchase.

## What never stops working

Everything you have already made stays viewable, shareable and exportable, on
every plan, including after a subscription lapses and after you stop paying
altogether. Export is free forever. We will not hold your records to ransom.

## Ending it

You can delete your business in the app at any time. We may end an account
that breaks these terms, and will tell you why unless the law stops us.

## What we do not promise

DocFlow is provided as it is. We do not promise it will be uninterrupted or
free of faults, and we do not promise it fits any particular purpose of
yours. Nothing here limits liability for death, personal injury, or fraud,
and nothing limits a right the law gives you that cannot be signed away.

Otherwise, and to the extent the law allows, we are not liable for lost
profits, lost business or indirect losses, and our total liability is limited
to what you paid us in the twelve months before the claim.

**Keep your own copies of anything you cannot afford to lose.** Export exists
for exactly this, and it is free.

## Changes

We may change these terms. If a change matters to you we will say so in the
app before it takes effect. Carrying on using DocFlow after that is
acceptance.

## Law

These terms are governed by [[GOVERNING_LAW]].`
}

/* ------------------------------------------------------------- storage */

function storageBody(): string {
  const rows = STORAGE_KEYS.map(
    (key) => `**\`${key.key}\`** — ${key.purpose}. Kept: ${key.lifetime}.`,
  )

  return `Last updated: [[EFFECTIVE_DATE]]

## DocFlow sets no cookies

There is no analytics, no advertising, no session replay and no third-party
tag anywhere in DocFlow. That is why you were not shown a consent banner:
there is nothing non-essential to consent to, and a banner that gates nothing
is theatre.

What the app does use is your browser's or phone's own storage, for the
things listed below. Every one of them is strictly necessary — the app stops
doing something you asked for if it is removed.

## What is stored

${bullets(rows)}

## Clearing it

Clearing your browser's site data, or uninstalling the app, removes all of it.
On a device with no account that also removes your records, so export first —
Settings → Data & sync → Export all my data.`
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  { id: 'privacy', slug: 'legal/privacy', title: 'Privacy policy', body: privacyBody() },
  { id: 'terms', slug: 'legal/terms', title: 'Terms of service', body: termsBody() },
  { id: 'storage', slug: 'legal/storage', title: 'Cookies and storage', body: storageBody() },
]

export const documentById = (id: LegalDocument['id']): LegalDocument => {
  const found = LEGAL_DOCUMENTS.find((document) => document.id === id)
  if (found === undefined) throw new Error(`No legal document "${id}".`)
  return found
}
