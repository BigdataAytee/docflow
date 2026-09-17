/**
 * §G's pencil, which did nothing for as long as it existed (§G, §M, §K).
 *
 * The reference row carried a pencil button with an empty handler and a
 * comment saying the sheet behind it was not built. This is the rule it now
 * writes to.
 */

import { describe, expect, it } from 'vitest'

import {
  REFERENCE_MAX,
  overrideToStore,
  referenceProblem,
} from './reference-override'
import { issueDocument } from './issue'

describe('What an owner may type into the pencil', () => {
  /** The case it exists for: a number carried in from a paper book. */
  it.each([
    'DR-INV-0413',
    'INV-2026-0007',
    '2026-0044',
    'A1',
    'DR INV 0413',
    'INV.0413',
  ])('accepts %s as typed', (value) => {
    expect(referenceProblem(value)).toBeNull()
  })

  /**
   * NEVER REPAIRED. A reference is quoted back over the phone and typed into
   * somebody's ledger, so upper-casing it or stripping a space would mean the
   * document does not carry the number the owner believes it does (§K).
   */
  it('stores exactly what was typed, case and separators intact', () => {
    expect(overrideToStore('dr-inv-0413')).toBe('dr-inv-0413')
    expect(overrideToStore('DR INV 0413')).toBe('DR INV 0413')
  })

  /** The one repair: invisible whitespace nobody meant. */
  it('trims the spaces at the ends, and judges what it will store', () => {
    expect(overrideToStore('  DR-INV-0413  ')).toBe('DR-INV-0413')
    expect(referenceProblem('  DR-INV-0413  ')).toBeNull()
  })

  /** Clearing the box asks for the app's numbering back — a choice, not a fault. */
  it('reads an empty box as "use the generated one"', () => {
    expect(overrideToStore('')).toBeUndefined()
    expect(overrideToStore('   ')).toBeUndefined()
    expect(referenceProblem('')).toBe('empty')
  })

  it('refuses one too long for the column that prints it', () => {
    expect(referenceProblem('X'.repeat(REFERENCE_MAX))).toBeNull()
    expect(referenceProblem('X'.repeat(REFERENCE_MAX + 1))).toBe('too_long')
  })

  /**
   * A reference travels into a filename and into a shared link. A slash
   * breaks both, so it is refused rather than quietly swapped for something
   * else — the owner finds out while they are still looking at the field.
   */
  it.each(['INV/2026/1', 'a\nb', 'INV\\7', '<INV>', ' leading-only'.trim().replace('leading-only', '')])(
    'refuses %p',
    (value) => {
      expect(referenceProblem(value)).not.toBeNull()
    },
  )

  it('refuses one that does not start with a letter or a digit', () => {
    expect(referenceProblem('-INV-1')).toBe('unusable')
    expect(referenceProblem('.INV')).toBe('unusable')
  })
})

describe('Issuing uses the override when there is one (§G, §M)', () => {
  const base = {
    draft: {
      type: 'invoice' as const,
      currency: 'NGN',
      customerId: 'cus_1',
      lineItems: [
        { id: 'l1', description: 'Cement', quantityMilli: 1000, unitPriceMinor: 1000, taxable: false },
      ],
      issueDate: '2026-09-04',
    },
    currentStatus: 'draft',
    context: { paymentIsRecorded: false, signatureRequired: false, hasPaymentMethod: true },
    profile: { locale: 'EN-NG' as const },
    prefix: 'INV',
    sequence: 6,
    fromReservedBlock: false,
    deviceId: 'dev_abc',
    issuedAt: '2026-09-04T10:00:00.000Z',
  }

  it('mints the generated sequence when the pencil was never used', () => {
    const issued = issueDocument(base as never)
    expect(issued.reference).toContain('INV-')
    expect(issued.reference).not.toBe('DR-INV-0413')
  })

  /** THE ONE THIS IS FOR. */
  it('uses the owner’s number verbatim when they set one', () => {
    const issued = issueDocument({ ...base, referenceOverride: 'DR-INV-0413' } as never)
    expect(issued.reference).toBe('DR-INV-0413')
  })

  it('falls back to the sequence when the override is blank', () => {
    const issued = issueDocument({ ...base, referenceOverride: '   ' } as never)
    expect(issued.reference).toContain('INV-')
  })

  /**
   * No device tag is bolted onto it. §M appends one to an offline reference so
   * two phones cannot mint the same number — but an owner who typed their own
   * number has said what the document is called, and decorating it would give
   * them a reference they did not choose. Uniqueness is the database's job
   * here: §M's `unique (company_id, type, issued_reference)` refuses a
   * duplicate outright, which is the only answer that cannot race.
   */
  it('does not decorate the owner’s number with a device tag', () => {
    const issued = issueDocument({
      ...base,
      referenceOverride: 'DR-INV-0413',
      fromReservedBlock: false,
    } as never)
    expect(issued.reference).toBe('DR-INV-0413')
  })
})
