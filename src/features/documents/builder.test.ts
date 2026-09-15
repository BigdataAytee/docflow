/**
 * The five-step builder (§G).
 *
 * The clause these guard: "Draft saving is always allowed. Final issue
 * validates the signature requirement and per-type required fields … an
 * invoice requires an enabled payment method; a receipt requires an actual
 * recorded payment; quotations and deliveries require no payment setup."
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_TYPES, type DocumentType, quantity } from '../../domain/documents/types'
import {
  type BuilderState,
  type DocumentDraft,
  type IssueContext,
  STEP_COUNT,
  back,
  canIssue,
  canSaveDraft,
  clampStep,
  committed,
  edit,
  firstProblemStep,
  isLastStep,
  next,
  primaryAction,
  stepNames,
  validateForIssue,
} from './builder'

const line = (priced = true) => ({
  id: 'l1',
  description: 'Cement',
  quantityMilli: quantity(3),
  ...(priced ? { unitPriceMinor: 500_000 } : {}),
  taxable: true,
})

const draftFor = (type: DocumentType, over: Partial<DocumentDraft> = {}): DocumentDraft => ({
  type,
  currency: 'NGN',
  customerId: 'cus_1',
  issueDate: '2026-09-11',
  lineItems: [line(type !== 'waybill')],
  ...over,
})

const ctx = (over: Partial<IssueContext> = {}): IssueContext => ({
  enabledPaymentMethodCount: 1,
  paymentIsRecorded: true,
  signatureRequired: false,
  ...over,
})

describe('Five steps, named per type (§G)', () => {
  it('gives every type exactly five step names', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(stepNames({ locale: 'EN-NG' }, type)).toHaveLength(STEP_COUNT)
    }
  })

  it('names a delivery document differently from a priced one', () => {
    const money = stepNames({ locale: 'EN-NG' }, 'invoice')
    const delivery = stepNames({ locale: 'EN-NG' }, 'waybill')
    expect(delivery[0]).not.toBe(money[0])
    expect(delivery[1]).not.toBe(money[1])
    // The last two are shared across types.
    expect(delivery[3]).toBe(money[3])
    expect(delivery[4]).toBe(money[4])
  })

  it('follows the locale', () => {
    expect(stepNames({ locale: 'FR' }, 'invoice')[0]).toBe('Détails')
  })
})

describe('Draft saving is always allowed (§G)', () => {
  it('permits a save no matter how incomplete', () => {
    const empty: DocumentDraft = { type: 'invoice', currency: 'NGN', lineItems: [] }
    expect(canSaveDraft()).toBe(true)
    // …and the draft is still reported as un-issuable, without being blocked.
    expect(validateForIssue(empty, ctx()).length).toBeGreaterThan(0)
  })

  it('never discards what was typed when validation fails', () => {
    const { customerId: _omitted, ...typed } = draftFor('invoice')
    const problems = validateForIssue(typed, ctx())
    expect(problems.some((p) => p.field === 'party')).toBe(true)
    expect(typed.lineItems).toHaveLength(1)
    expect(typed.lineItems[0]?.description).toBe('Cement')
  })
})

describe('What final issue demands, per type (§G, §J, §K)', () => {
  it('lets a complete invoice through', () => {
    expect(canIssue(draftFor('invoice'), ctx())).toBe(true)
  })

  it('requires an enabled payment method for an invoice only', () => {
    const noMethods = ctx({ enabledPaymentMethodCount: 0 })
    expect(
      validateForIssue(draftFor('invoice'), noMethods).some((p) => p.field === 'payment_method'),
    ).toBe(true)
    // §J: quotations and deliveries require no payment setup, ever.
    expect(canIssue(draftFor('quotation'), noMethods)).toBe(true)
    expect(
      canIssue(
        draftFor('waybill', { deliveryAddress: '12 Balogun St', dispatchDate: '2026-09-11' }),
        noMethods,
      ),
    ).toBe(true)
  })

  it('rejects a receipt without an effective payment (§K)', () => {
    const noPayment = draftFor('receipt')
    expect(validateForIssue(noPayment, ctx()).some((p) => p.field === 'recorded_payment')).toBe(true)

    const claimed = draftFor('receipt', { paymentId: 'pay_1' })
    expect(
      validateForIssue(claimed, ctx({ paymentIsRecorded: false })).some(
        (p) => p.field === 'recorded_payment',
      ),
    ).toBe(true)

    expect(canIssue(claimed, ctx({ paymentIsRecorded: true }))).toBe(true)
  })

  it('requires a delivery address and dispatch date on a delivery document', () => {
    const fields = validateForIssue(draftFor('waybill'), ctx()).map((p) => p.field)
    expect(fields).toContain('delivery_address')
    expect(fields).toContain('dispatch_date')
  })

  it('refuses a priced line on a delivery document (§G, §V)', () => {
    const priced = draftFor('waybill', {
      deliveryAddress: 'x',
      dispatchDate: '2026-09-11',
      lineItems: [line(true)],
    })
    expect(
      validateForIssue(priced, ctx()).some((p) => p.field === 'delivery_carries_no_money'),
    ).toBe(true)
  })

  it('requires a price on a priced document', () => {
    const unpriced = draftFor('invoice', { lineItems: [line(false)] })
    expect(validateForIssue(unpriced, ctx()).some((p) => p.field === 'line_price')).toBe(true)
  })

  it('enforces the signature requirement when the company sets one', () => {
    expect(
      validateForIssue(draftFor('invoice'), ctx({ signatureRequired: true })).some(
        (p) => p.field === 'signature',
      ),
    ).toBe(true)
    expect(canIssue(draftFor('invoice', { signatureAssetId: 'a1' }), ctx({ signatureRequired: true }))).toBe(
      true,
    )
  })

  it('always needs a party and at least one line, for every type', () => {
    for (const type of DOCUMENT_TYPES) {
      const bare: DocumentDraft = { type, currency: 'NGN', lineItems: [] }
      const fields = validateForIssue(bare, ctx()).map((p) => p.field)
      expect(fields, type).toContain('party')
      expect(fields, type).toContain('line_items')
    }
  })
})

describe('The review screen links each problem to its step (§G step 5)', () => {
  it('tags every problem with a real step index', () => {
    const problems = validateForIssue({ type: 'invoice', currency: 'NGN', lineItems: [] }, ctx({ enabledPaymentMethodCount: 0 }))
    for (const p of problems) {
      expect(p.step).toBeGreaterThanOrEqual(0)
      expect(p.step).toBeLessThan(STEP_COUNT)
    }
  })

  it('points "fix this" at the earliest step with a problem', () => {
    const problems = validateForIssue(
      { type: 'invoice', currency: 'NGN', lineItems: [] },
      ctx({ enabledPaymentMethodCount: 0 }),
    )
    expect(firstProblemStep(problems)).toBe(0)
    expect(firstProblemStep([])).toBeNull()
  })
})

describe('Step navigation and autosave state', () => {
  const start: BuilderState = { step: 0, draft: draftFor('invoice'), dirty: false }

  it('moves in both directions and clamps at the ends', () => {
    expect(next(start).step).toBe(1)
    expect(back(start).step).toBe(0)
    expect(clampStep(99)).toBe(4)
    expect(clampStep(-3)).toBe(0)
  })

  it('turns Next into Save on the last step (§G)', () => {
    expect(primaryAction(0)).toBe('next')
    expect(primaryAction(4)).toBe('save')
    expect(isLastStep(4)).toBe(true)
  })

  it('never gates a step behind validation — review links back to it', () => {
    const broken: BuilderState = { step: 0, draft: { type: 'invoice', currency: 'NGN', lineItems: [] }, dirty: false }
    expect(next(broken).step).toBe(1)
  })

  it('marks an edit dirty and refuses to change the type', () => {
    const edited = edit(start, { customerId: 'cus_2', type: 'receipt' as never })
    expect(edited.dirty).toBe(true)
    expect(edited.draft.customerId).toBe('cus_2')
    expect(edited.draft.type).toBe('invoice')
  })

  it('only clears dirty on an actual commit (§C)', () => {
    // "A failed commit must not show Saved" — so nothing but a real write,
    // with its timestamp, can clear the flag.
    const edited = edit(start, { customerId: 'cus_2' })
    expect(edited.dirty).toBe(true)
    expect(next(edited).dirty).toBe(true)

    const saved = committed(edited, '2026-09-11T12:00:00Z')
    expect(saved.dirty).toBe(false)
    expect(saved.lastSavedAt).toBe('2026-09-11T12:00:00Z')
  })
})

describe('An enabled method that cannot be used is not payment setup (§J, §G step 5)', () => {
  /**
   * The gate asked whether a method was PRESENT. Bank transfer switched on
   * with its three §J fields empty passed — and the invoice it issued printed
   * no HOW TO PAY box at all, because `buildPaymentBox` filters empty rows
   * and finds none. The customer got a bill with no way to pay it.
   *
   * The person is blocked either way. The only question is whether they find
   * out here or through their customer a week later.
   */
  const enabledButEmpty = ctx({ enabledPaymentMethodCount: 1, usablePaymentMethodCount: 0 })

  it('blocks the invoice, and names the fix rather than the absence', () => {
    const problems = validateForIssue(draftFor('invoice'), enabledButEmpty)
    const fields = problems.map((p) => p.field)

    expect(fields).toContain('payment_details')
    // NOT the other one: "set up how you get paid" is wrong and unhelpful
    // when a method is already on. The account is what is empty.
    expect(fields).not.toContain('payment_method')
    expect(canIssue(draftFor('invoice'), enabledButEmpty)).toBe(false)
  })

  it('sends the fix to Settings rather than to a step that cannot fix it', () => {
    const problems = validateForIssue(draftFor('invoice'), enabledButEmpty)
    expect(problems.find((p) => p.field === 'payment_details')?.fixIn).toBe('payment_settings')
    // The older one had the same wrong destination, and now says so too.
    const none = validateForIssue(draftFor('invoice'), ctx({ enabledPaymentMethodCount: 0 }))
    expect(none.find((p) => p.field === 'payment_method')?.fixIn).toBe('payment_settings')
  })

  /** THE OTHER DIRECTION. A complete account issues with no friction at all. */
  it('lets a complete one through without comment', () => {
    const ready = ctx({ enabledPaymentMethodCount: 1, usablePaymentMethodCount: 1 })
    expect(validateForIssue(draftFor('invoice'), ready)).toEqual([])
    expect(canIssue(draftFor('invoice'), ready)).toBe(true)
  })

  /** §J: payment setup is enforced on invoices and nothing else, ever. */
  it('leaves quotations and delivery documents alone', () => {
    expect(canIssue(draftFor('quotation'), enabledButEmpty)).toBe(true)
    expect(
      canIssue(
        draftFor('waybill', { deliveryAddress: '12 Balogun St', dispatchDate: '2026-09-11' }),
        enabledButEmpty,
      ),
    ).toBe(true)
  })

  /** §G: "Draft saving is always allowed." The gate is issue and only issue. */
  it('never stands between anybody and a saved draft', () => {
    expect(canSaveDraft()).toBe(true)
  })

  /**
   * A caller that has not been taught to compute usability behaves exactly as
   * it did — the gate must never tighten on a value nobody supplied.
   */
  it('falls back to the enabled count when usability was not computed', () => {
    const old: IssueContext = {
      enabledPaymentMethodCount: 1,
      paymentIsRecorded: true,
      signatureRequired: false,
    }
    expect(canIssue(draftFor('invoice'), old)).toBe(true)
  })
})
