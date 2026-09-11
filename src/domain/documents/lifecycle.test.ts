/**
 * Lifecycle transition tests — blocking before merge (CLAUDE.md).
 * Issued documents are immutable; corrections are void / credit / reissue.
 */

import { describe, expect, it } from 'vitest'

import {
  LifecycleError,
  assertTransition,
  canTransition,
  deriveInvoiceState,
  deriveQuotationState,
  isEvidenceSealed,
  isImmutable,
  issueRequirements,
} from './lifecycle'
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, carriesMoney } from './types'
import { money } from '../money/money'

const NGN = (minor: number) => money('NGN', minor)

describe('Issued documents are immutable (§C, §M)', () => {
  it('marks every non-draft status immutable, for every type', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const status of DOCUMENT_STATUSES[type]) {
        expect(isImmutable(type, status)).toBe(status !== 'draft')
      }
    }
  })

  it('never allows an issued document back to draft', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const status of DOCUMENT_STATUSES[type]) {
        if (status === 'draft') continue
        expect(canTransition(type, status, 'draft')).toBe(false)
      }
    }
  })

  it('makes void terminal', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const status of DOCUMENT_STATUSES[type]) {
        expect(canTransition(type, 'void', status)).toBe(false)
      }
    }
  })

  it('corrects an issued invoice by voiding, not editing', () => {
    expect(canTransition('invoice', 'issued', 'void')).toBe(true)
    expect(() => assertTransition('invoice', 'issued', 'draft')).toThrow(LifecycleError)
  })

  it('seals delivery evidence once delivered (§P)', () => {
    expect(isEvidenceSealed('waybill', 'delivered')).toBe(true)
    expect(canTransition('waybill', 'delivered', 'in_transit')).toBe(false)
    expect(canTransition('waybill', 'delivered', 'void')).toBe(false)
  })

  it('rejects an unknown status or a status from another type', () => {
    expect(canTransition('invoice', 'draft', 'delivered')).toBe(false)
    expect(canTransition('receipt', 'draft', 'accepted')).toBe(false)
    expect(canTransition('invoice', 'nonsense', 'issued')).toBe(false)
  })
})

describe('The delivery path', () => {
  it('runs draft → issued → dispatched → in transit → delivered', () => {
    const path = ['draft', 'issued', 'dispatched', 'in_transit', 'delivered']
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition('waybill', path[i]!, path[i + 1]!)).toBe(true)
    }
  })

  it('allows dispatch straight to delivered', () => {
    expect(canTransition('waybill', 'dispatched', 'delivered')).toBe(true)
  })
})

describe('Derived payment state is computed, never stored (§C)', () => {
  const base = { status: 'issued' as const, total: NGN(145_000_00), asOf: '2026-09-11' }

  it('is unpaid when nothing has been received', () => {
    expect(deriveInvoiceState({ ...base, outstanding: NGN(145_000_00) })).toBe('unpaid')
  })

  it('is partially paid after a part payment', () => {
    expect(deriveInvoiceState({ ...base, outstanding: NGN(95_000_00) })).toBe('partially_paid')
  })

  it('is paid when the balance reaches zero', () => {
    expect(deriveInvoiceState({ ...base, outstanding: NGN(0) })).toBe('paid')
  })

  it('is overdue past the due date while money is still owed', () => {
    expect(
      deriveInvoiceState({ ...base, outstanding: NGN(95_000_00), dueDate: '2026-09-01' }),
    ).toBe('overdue')
  })

  it('is never overdue once settled', () => {
    expect(deriveInvoiceState({ ...base, outstanding: NGN(0), dueDate: '2026-09-01' })).toBe('paid')
  })

  it('expires a quotation by date, not by a stored flag', () => {
    expect(
      deriveQuotationState({ status: 'issued', validUntil: '2026-09-01', asOf: '2026-09-11' }),
    ).toBe('expired')
    expect(
      deriveQuotationState({ status: 'accepted', validUntil: '2026-09-01', asOf: '2026-09-11' }),
    ).toBe('accepted')
    expect(deriveQuotationState({ status: 'issued', asOf: '2026-09-11' })).toBe('open')
  })
})

describe('Issue requirements (§G step 5, §J)', () => {
  it('requires a payment method for an invoice only', () => {
    expect(issueRequirements('invoice').needsPaymentMethod).toBe(true)
    expect(issueRequirements('quotation').needsPaymentMethod).toBe(false)
    expect(issueRequirements('waybill').needsPaymentMethod).toBe(false)
    expect(issueRequirements('receipt').needsPaymentMethod).toBe(false)
  })

  it('requires an actual recorded payment before a receipt is issued', () => {
    expect(issueRequirements('receipt').needsRecordedPayment).toBe(true)
    for (const type of ['invoice', 'quotation', 'waybill'] as const) {
      expect(issueRequirements(type).needsRecordedPayment).toBe(false)
    }
  })
})

describe('The internal vocabulary never localises', () => {
  it('keeps a delivery document typed waybill everywhere on Earth (§D)', () => {
    expect(DOCUMENT_TYPES).toEqual(['invoice', 'quotation', 'receipt', 'waybill'])
  })

  it('gives money to every type but the delivery document', () => {
    expect(DOCUMENT_TYPES.filter((t) => !carriesMoney(t))).toEqual(['waybill'])
  })
})
