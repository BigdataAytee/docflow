/**
 * Issuing (§G step 5, §M) and the device-qualified reference (§M design task).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { type DocumentType, quantity } from '../../domain/documents/types'
import { LifecycleError } from '../../domain/documents/lifecycle'
import {
  EXPLANATION,
  ReferenceError,
  buildReference,
  deviceTag,
  parseReference,
  wasIssuedOffline,
} from './reference'
import { IssueError, issueDocument } from './issue'
import type { DocumentDraft, IssueContext } from './builder'

const draftFor = (type: DocumentType, over: Partial<DocumentDraft> = {}): DocumentDraft => ({
  type,
  currency: 'NGN',
  customerId: 'cus_1',
  issueDate: '2026-09-11',
  lineItems: [
    {
      id: 'l1',
      description: 'Cement',
      quantityMilli: quantity(3),
      ...(type === 'waybill' ? {} : { unitPriceMinor: 500_000 }),
      taxable: true,
    },
  ],
  ...over,
})

const ctx: IssueContext = {
  enabledPaymentMethodCount: 1,
  paymentIsRecorded: true,
  signatureRequired: false,
}

const base = {
  currentStatus: 'draft',
  context: ctx,
  profile: { locale: 'EN-NG' },
  prefix: 'INV',
  sequence: 42,
  fromReservedBlock: true,
  deviceId: 'device-abc',
  issuedAt: '2026-09-11T12:00:00Z',
}

describe('The device-qualified reference (§M design task)', () => {
  it('uses a plain reference when the number came from a reserved block', () => {
    expect(buildReference({ ...base, fromReservedBlock: true })).toBe('INV-0042')
  })

  it('adds a short device tag when issued offline', () => {
    const reference = buildReference({ ...base, fromReservedBlock: false })
    expect(reference).toMatch(/^INV-0042-[0-9A-Z]{2}$/)
    expect(wasIssuedOffline(reference)).toBe(true)
  })

  it('keeps the prefix and number shape a customer already recognises', () => {
    const parsed = parseReference(buildReference({ ...base, fromReservedBlock: false }))
    expect(parsed?.prefix).toBe('INV')
    expect(parsed?.sequence).toBe(42)
  })

  it('gives the same device the same tag forever', () => {
    // A reference must never change after issue, so the tag cannot drift.
    const first = deviceTag('device-abc')
    for (let i = 0; i < 50; i++) expect(deviceTag('device-abc')).toBe(first)
  })

  it('gives different devices different tags, mostly', () => {
    const tags = new Set(Array.from({ length: 200 }, (_, i) => deviceTag(`device-${i}`)))
    // 32^2 = 1024 possible tags; 200 devices should spread widely. The server
    // enforces real uniqueness (§M) — this only makes a clash a non-event.
    expect(tags.size).toBeGreaterThan(100)
  })

  it('never emits a character that reads as a digit', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (id) => {
        if (id.trim() === '') return
        expect(deviceTag(id)).not.toMatch(/[ILOU]/)
      }),
    )
  })

  it('round-trips through parse for any sequence', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999 }), (sequence) => {
        const reference = buildReference({ ...base, sequence, fromReservedBlock: false })
        expect(parseReference(reference)?.sequence).toBe(sequence)
      }),
    )
  })

  it('refuses a missing prefix, a bad sequence or a missing device id', () => {
    expect(() => buildReference({ ...base, prefix: '  ' })).toThrow(ReferenceError)
    expect(() => buildReference({ ...base, sequence: 0 })).toThrow(ReferenceError)
    expect(() => buildReference({ ...base, fromReservedBlock: false, deviceId: '' })).toThrow(
      ReferenceError,
    )
  })

  it('ships a one-line explanation for Settings (§M)', () => {
    expect(EXPLANATION.length).toBeLessThan(140)
    expect(EXPLANATION).toMatch(/without internet/i)
  })
})

describe('Reference, labels and totals freeze together (§M)', () => {
  it('returns one frozen value, so a partial issue cannot be persisted', () => {
    const issued = issueDocument({ ...base, draft: draftFor('invoice') })
    expect(issued.reference).toBe('INV-0042')
    expect(issued.frozenLabels.printedTitle).toBe('INVOICE')
    expect(issued.totals?.payable.minor).toBe(1_500_000)
    expect(Object.isFrozen(issued)).toBe(true)
  })

  it('freezes the labels of the profile at the moment of issue', () => {
    const issued = issueDocument({
      ...base,
      prefix: 'WAY',
      draft: draftFor('waybill', { deliveryAddress: '12 Balogun St', dispatchDate: '2026-09-11' }),
      profile: { locale: 'EN-NG' },
    })
    expect(issued.frozenLabels.printedTitle).toBe('WAYBILL')
    expect(issued.frozenLabels.signatureCaption).toBe('DISPATCHED BY')
    // A delivery document freezes no totals — there are none (§V).
    expect(issued.totals).toBeNull()
  })

  it('refuses to issue a draft that is not ready, naming the problems', () => {
    try {
      issueDocument({
        ...base,
        draft: draftFor('invoice'),
        context: { ...ctx, enabledPaymentMethodCount: 0 },
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(IssueError)
      expect((error as IssueError).problems.map((p) => p.field)).toContain('payment_method')
    }
  })

  it('refuses to issue an already-issued document a second time (§M)', () => {
    // Issuing twice would mint a second reference for one document.
    expect(() =>
      issueDocument({ ...base, draft: draftFor('invoice'), currentStatus: 'issued' }),
    ).toThrow(LifecycleError)
  })

  it('refuses a receipt with no recorded payment even at the issue boundary', () => {
    expect(() =>
      issueDocument({
        ...base,
        prefix: 'REC',
        draft: draftFor('receipt'),
        context: { ...ctx, paymentIsRecorded: false },
      }),
    ).toThrow(IssueError)
  })
})
