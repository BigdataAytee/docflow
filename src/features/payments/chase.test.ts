/**
 * "Chase this money" (§G, §L1, §M).
 */

import { describe, expect, it } from 'vitest'

import { money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
import { ChaseError, type ChaseTemplates, draftBothTones, draftChase, shareEventFor } from './chase'

const NGN = (m: number) => money('NGN', m)

const templates: ChaseTemplates = {
  softerOpening: 'Hello {customer}, hope business is good.',
  firmerOpening: '{customer}, this payment is now overdue.',
  amountLine: '{amount} is outstanding on {reference}.',
  dueLine: 'It is due on {due}.',
  overdueLine: 'It was due on {due}.',
  howToPay: 'You can pay into:',
  closing: 'Thank you — {business}',
}

const base = {
  customerName: 'Okoro & Sons',
  businessName: 'Dynamic Renaissance',
  reference: 'INV-0042',
  outstanding: NGN(95_000_00),
  currency: 'NGN',
  bankValues: {
    bank_name: 'Guaranty Trust Bank',
    account_number: '0123456789',
    account_name: 'Dynamic Renaissance Ltd',
  },
  formatAmount: formatMoney,
  templates,
}

describe('It quotes the real figure and the real bank details (§L1)', () => {
  it('uses the outstanding balance, not the invoice total', () => {
    const message = draftChase(base, 'softer')
    expect(message.text).toContain('₦95,000.00 is outstanding on INV-0042.')
    expect(message.quotedAmount).toEqual(NGN(95_000_00))
  })

  it('prints the actual saved bank fields', () => {
    const message = draftChase(base, 'softer')
    expect(message.text).toContain('Bank: Guaranty Trust Bank')
    expect(message.text).toContain('Account number: 0123456789')
  })

  it('omits bank lines entirely when nothing is saved, rather than inventing them', () => {
    const message = draftChase({ ...base, bankValues: {} }, 'softer')
    expect(message.text).not.toContain('You can pay into:')
    expect(message.text).not.toContain('Bank:')
  })

  it('shortens rather than printing a half-filled field', () => {
    const message = draftChase(
      { ...base, bankValues: { bank_name: 'GTB', account_name: 'Ltd' } },
      'softer',
    )
    expect(message.text).toContain('Bank: GTB')
    expect(message.text).not.toContain('Account number:')
  })

  it('refuses to chase a settled document — the worst thing it could send', () => {
    expect(() => draftChase({ ...base, outstanding: NGN(0) }, 'softer')).toThrow(ChaseError)
  })
})

describe('Softer and Firmer, both offered (§G)', () => {
  it('drafts two variants so the user chooses', () => {
    const both = draftBothTones(base)
    expect(both.map((m) => m.tone)).toEqual(['softer', 'firmer'])
    expect(both[0]?.text).toContain('hope business is good')
    expect(both[1]?.text).toContain('now overdue')
  })

  it('quotes the same figure in both', () => {
    const both = draftBothTones(base)
    expect(both[0]?.quotedAmount).toEqual(both[1]?.quotedAmount)
  })

  it('speaks whatever language the templates are in (§S)', () => {
    const french = draftChase(
      {
        ...base,
        templates: { ...templates, amountLine: '{amount} restent dus sur {reference}.' },
      },
      'softer',
    )
    expect(french.text).toContain('restent dus sur INV-0042')
  })
})

describe('Due dates read correctly for the tense (§G)', () => {
  it('says it is due when it is not yet', () => {
    expect(draftChase({ ...base, dueDate: '2026-09-25' }, 'softer', '2026-09-11').text).toContain(
      'It is due on 2026-09-25.',
    )
  })

  it('says it was due once the date has passed', () => {
    expect(draftChase({ ...base, dueDate: '2026-09-01' }, 'firmer', '2026-09-11').text).toContain(
      'It was due on 2026-09-01.',
    )
  })

  it('mentions no date when the document has none', () => {
    expect(draftChase(base, 'softer').text).not.toContain('due on')
  })
})

describe('Composing is not sending (§G, §M)', () => {
  it('returns text and nothing else — no side effect to observe', () => {
    const message = draftChase(base, 'softer')
    expect(typeof message.text).toBe('string')
  })

  it('records a sharing event, never a delivery (§M)', () => {
    const event = shareEventFor('doc-1', draftChase(base, 'softer'), '2026-09-11T12:00:00Z')
    expect(event).toEqual({
      documentId: 'doc-1',
      at: '2026-09-11T12:00:00Z',
      channel: 'whatsapp',
      quotedAmountMinor: 95_000_00,
    })
    // Deliberately absent: there is no `delivered` or `read` field to set,
    // because the app cannot know either (§M).
    expect(Object.keys(event)).not.toContain('delivered')
  })
})
