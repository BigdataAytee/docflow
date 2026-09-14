/**
 * Importing customers without importing them twice (§Q Phase 4).
 *
 * §Q asks for "contacts import (deduped)" and "CSV customer import with
 * column-mapping preview". The two sources are different; what happens to the
 * rows afterwards is identical, so it lives here once and neither importer
 * owns a copy.
 *
 * **Why dedupe is not optional.** A phone address book holds the same person
 * several times — a SIM copy, a Google copy, a WhatsApp copy — and an import
 * that trusts it produces three "Musa Ibrahim"s. The owner then records a
 * payment against one of them, and their customer balance is quietly wrong in
 * a way no error message will ever mention. That is a Rule #3 failure arriving
 * through the front door: the money is exact, and it is attached to the wrong
 * person.
 *
 * **What counts as the same customer.** Phone first, then email, then name.
 *  · A phone number is the strongest signal a small business has, but only
 *    after normalising: `0803 123 4567`, `+234 803 123 4567` and
 *    `234-803-123-4567` are one number, and comparing them as typed finds
 *    three people.
 *  · An email is next, lower-cased.
 *  · A name alone matches only on an exact fold — no fuzzy matching, ever.
 *    Two real businesses are called "City Ventures"; merging them silently
 *    would be worse than importing both, because an owner can delete a
 *    duplicate and cannot recover a merge.
 *
 * Nothing here decides anything on its own. It CLASSIFIES, and the preview
 * screen shows the owner what will happen before a single row is written —
 * which is the actual §Q requirement and the reason `plan` returns a report
 * rather than performing an import.
 */

import type { Customer } from '../../../data/repositories'

/** A row as it arrives, from contacts or from a CSV. */
export interface ImportCandidate {
  readonly name: string
  readonly phone?: string
  readonly email?: string
  readonly address?: string
}

export type ImportVerdict =
  | { readonly kind: 'new' }
  /** Already in the book. Skipped, with the record it matched. */
  | { readonly kind: 'duplicate'; readonly of: Customer; readonly matchedOn: MatchField }
  /** Two rows in the same import are each other. The first wins. */
  | { readonly kind: 'repeated'; readonly matchedOn: MatchField }
  /** Nothing usable. A contact with no name is not a customer. */
  | { readonly kind: 'unusable'; readonly reason: string }

export type MatchField = 'phone' | 'email' | 'name'

export interface PlannedRow {
  readonly candidate: ImportCandidate
  readonly verdict: ImportVerdict
}

export interface ImportPlan {
  readonly rows: readonly PlannedRow[]
  readonly toCreate: number
  readonly duplicates: number
  readonly unusable: number
}

/**
 * Digits only, and the country trunk prefix folded away.
 *
 * `0803…` and `+234803…` are the same Nigerian number written two ways, and an
 * address book holds both. Comparing the last nine digits is what makes them
 * one person — long enough that two different numbers do not collide, short
 * enough to survive any country code or leading zero.
 *
 * Nine is not a rule about Nigeria: it is the shortest national subscriber
 * number in the launch markets, so it is the longest suffix every format
 * shares.
 */
export function normalisePhone(phone: string | undefined): string | null {
  if (phone === undefined) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  return digits.slice(-9)
}

export const normaliseEmail = (email: string | undefined): string | null => {
  const trimmed = email?.trim().toLocaleLowerCase()
  return trimmed === undefined || trimmed === '' || !trimmed.includes('@') ? null : trimmed
}

/** Collapses spacing and case. Never fuzzy — see the header. */
export const foldName = (name: string): string =>
  name.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

interface Index {
  readonly byPhone: Map<string, Customer>
  readonly byEmail: Map<string, Customer>
  readonly byName: Map<string, Customer>
}

const indexOf = (existing: readonly Customer[]): Index => {
  const byPhone = new Map<string, Customer>()
  const byEmail = new Map<string, Customer>()
  const byName = new Map<string, Customer>()

  for (const customer of existing) {
    const phone = normalisePhone(customer.phone)
    if (phone !== null && !byPhone.has(phone)) byPhone.set(phone, customer)
    const email = normaliseEmail(customer.email)
    if (email !== null && !byEmail.has(email)) byEmail.set(email, customer)
    const name = foldName(customer.name)
    if (name !== '' && !byName.has(name)) byName.set(name, customer)
  }

  return { byPhone, byEmail, byName }
}

/**
 * What an import WOULD do. Writes nothing.
 *
 * The preview screen renders this; the importer then writes only the rows
 * whose verdict is `new`. Separating the two means the owner sees the same
 * decision that gets acted on, rather than a summary computed twice.
 */
export function plan(
  candidates: readonly ImportCandidate[],
  existing: readonly Customer[],
): ImportPlan {
  const index = indexOf(existing)
  const seen: Index = { byPhone: new Map(), byEmail: new Map(), byName: new Map() }
  const rows: PlannedRow[] = []

  for (const candidate of candidates) {
    rows.push({ candidate, verdict: classify(candidate, index, seen) })
  }

  return {
    rows,
    toCreate: rows.filter((row) => row.verdict.kind === 'new').length,
    duplicates: rows.filter(
      (row) => row.verdict.kind === 'duplicate' || row.verdict.kind === 'repeated',
    ).length,
    unusable: rows.filter((row) => row.verdict.kind === 'unusable').length,
  }
}

function classify(candidate: ImportCandidate, index: Index, seen: Index): ImportVerdict {
  const name = foldName(candidate.name)
  if (name === '') {
    // A phone book holds these — a number saved with no name at all. An
    // unnamed customer is a row nobody can find again.
    return { kind: 'unusable', reason: 'No name' }
  }

  const phone = normalisePhone(candidate.phone)
  const email = normaliseEmail(candidate.email)

  // Strongest signal first, so a matched phone is never overruled by a
  // coincidence of names.
  const existing =
    (phone !== null ? index.byPhone.get(phone) : undefined) ??
    (email !== null ? index.byEmail.get(email) : undefined) ??
    index.byName.get(name)

  if (existing !== undefined) {
    const matchedOn: MatchField =
      phone !== null && index.byPhone.has(phone)
        ? 'phone'
        : email !== null && index.byEmail.has(email)
          ? 'email'
          : 'name'
    return { kind: 'duplicate', of: existing, matchedOn }
  }

  // The same person twice in ONE import — the SIM copy and the Google copy.
  if (phone !== null && seen.byPhone.has(phone)) return { kind: 'repeated', matchedOn: 'phone' }
  if (email !== null && seen.byEmail.has(email)) return { kind: 'repeated', matchedOn: 'email' }
  if (seen.byName.has(name)) return { kind: 'repeated', matchedOn: 'name' }

  const placeholder = { id: '', companyId: '', kind: 'person', name, labels: [] } as Customer
  if (phone !== null) seen.byPhone.set(phone, placeholder)
  if (email !== null) seen.byEmail.set(email, placeholder)
  seen.byName.set(name, placeholder)

  return { kind: 'new' }
}
