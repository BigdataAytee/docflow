/**
 * Four actions per type, always the same four (§G, §N).
 *
 * The saved document had grown a COLUMN of full-width buttons that appeared
 * and disappeared as the delivery lifecycle advanced. The lifecycle reasoning
 * was right — something that never left cannot have arrived (§M) — and the
 * conclusion was wrong: §N says an unavailable capability is SAID, not hidden,
 * and a grid whose shape changes under an owner's thumb teaches them nothing
 * about why.
 */

import { describe, expect, it } from 'vitest'

import { type ActionInput, documentActions } from './actions'
import { DOCUMENT_TYPES } from '../../domain/documents/types'

const doc = (over: Partial<ActionInput> & Pick<ActionInput, 'type'>): ActionInput => ({
  status: 'issued',
  ...over,
})

const ids = (input: ActionInput) => documentActions(input).map((action) => action.id)
const live = (input: ActionInput) =>
  documentActions(input)
    .filter((action) => action.enabled)
    .map((action) => action.id)

describe('Always four, whatever the type and whatever the state', () => {
  it.each(DOCUMENT_TYPES)('gives a %s exactly four', (type) => {
    expect(documentActions(doc({ type }))).toHaveLength(4)
  })

  /**
   * The count does not move with the lifecycle. This is the whole complaint:
   * a draft, an issued document and a signed one all show four pills, and what
   * changes is which of them are live.
   */
  it.each(DOCUMENT_TYPES)('keeps four on a %s through every state', (type) => {
    for (const status of ['draft', 'issued', 'sent', 'void']) {
      for (const dispatched of [true, false]) {
        for (const signed of [true, false]) {
          expect(
            documentActions(doc({ type, status, dispatched, signed })),
            `${type}/${status}/${dispatched}/${signed}`,
          ).toHaveLength(4)
        }
      }
    }
  })

  /** Every disabled action says WHY — the §N clause, in the type system. */
  it.each(DOCUMENT_TYPES)('never disables a %s action without a reason', (type) => {
    for (const status of ['draft', 'issued', 'void']) {
      for (const action of documentActions(doc({ type, status }))) {
        if (!action.enabled) {
          expect(action.blockedBy, `${type}/${status}/${action.id}`).toBeDefined()
        } else {
          expect(action.blockedBy, `${type}/${action.id} is live AND blocked`).toBeUndefined()
        }
      }
    }
  })
})

describe('The four §G names, per type', () => {
  it('gives an invoice share / convert / sign / void-or-credit', () => {
    expect(ids(doc({ type: 'invoice' }))).toEqual([
      'share_pdf',
      'convert',
      'sign',
      'void_or_credit',
    ])
  })

  it('gives a quotation the accept link and Rev 2', () => {
    expect(ids(doc({ type: 'quotation' }))).toEqual([
      'share_pdf',
      'convert',
      'copy_accept_link',
      'duplicate_rev2',
    ])
  })

  it('gives a receipt void-and-reissue and open-invoice', () => {
    expect(ids(doc({ type: 'receipt' }))).toEqual([
      'share_pdf',
      'convert',
      'void_and_reissue',
      'open_invoice',
    ])
  })

  /** Exactly the four the reference draws on a delivery. */
  it('gives a delivery share / signing link / convert / photo', () => {
    expect(ids(doc({ type: 'waybill' }))).toEqual([
      'share_pdf',
      'copy_signing_link',
      'convert',
      'add_photo',
    ])
  })
})

describe('A draft can do none of it, and says so', () => {
  it.each(DOCUMENT_TYPES)('offers a %s draft nothing live', (type) => {
    expect(live(doc({ type, status: 'draft' }))).toEqual([])
  })

  it('blames the draft, not the lifecycle', () => {
    const [share] = documentActions(doc({ type: 'invoice', status: 'draft' }))
    expect(share.blockedBy).toBe('not_issued')
  })
})

describe('The lifecycle clause survives intact (§M)', () => {
  /**
   * THE ONE THE OLD CODE WAS PROTECTING. A signing link cannot exist before
   * the goods have gone — a customer would be signing for nothing. It is dark
   * with a reason now instead of absent, which is the only thing that changed.
   */
  it('refuses a signing link until the goods have gone', () => {
    const waiting = documentActions(doc({ type: 'waybill', dispatched: false }))
    const link = waiting.find((action) => action.id === 'copy_signing_link')
    expect(link?.enabled).toBe(false)
    expect(link?.blockedBy).toBe('not_dispatched')
  })

  it('offers it once they have', () => {
    expect(live(doc({ type: 'waybill', dispatched: true }))).toContain('copy_signing_link')
  })

  /** A photo after the signature would change what the record says (§P). */
  it('seals the photo once it is signed for', () => {
    const signed = documentActions(doc({ type: 'waybill', dispatched: true, signed: true }))
    const photo = signed.find((action) => action.id === 'add_photo')
    expect(photo?.enabled).toBe(false)
    expect(photo?.blockedBy).toBe('sealed')
  })

  it('allows it before the signature', () => {
    expect(live(doc({ type: 'waybill', dispatched: true, signed: false }))).toContain('add_photo')
  })
})

describe('Rule #5 and §G’s convert list', () => {
  it('will not void what is already void', () => {
    const voided = documentActions(doc({ type: 'invoice', status: 'void' }))
    const action = voided.find((a) => a.id === 'void_or_credit')
    expect(action?.enabled).toBe(false)
    expect(action?.blockedBy).toBe('voided')
  })

  /** "A receipt is evidence of a payment" — there is nothing to turn it into. */
  it('offers a receipt no conversion, and says that is why', () => {
    const convert = documentActions(doc({ type: 'receipt' })).find((a) => a.id === 'convert')
    expect(convert?.enabled).toBe(false)
    expect(convert?.blockedBy).toBe('nothing_to_convert')
  })

  it.each(['quotation', 'invoice', 'waybill'] as const)('offers %s a conversion', (type) => {
    expect(live(doc({ type }))).toContain('convert')
  })

  /** A standalone receipt has no invoice behind it to open. */
  it('cannot open an invoice a receipt does not have', () => {
    const alone = documentActions(doc({ type: 'receipt' })).find((a) => a.id === 'open_invoice')
    expect(alone?.enabled).toBe(false)
    expect(alone?.blockedBy).toBe('no_invoice')

    const linked = documentActions(doc({ type: 'receipt', linkedInvoiceId: 'inv_1' }))
    expect(linked.find((a) => a.id === 'open_invoice')?.enabled).toBe(true)
  })
})
