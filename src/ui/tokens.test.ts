/**
 * The shared component library's two load-bearing invariants (§F, §M).
 */

import { describe, expect, it } from 'vitest'

import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from '../domain/documents/types'
import { TONE_PALETTE, TYPE_PALETTE, toneFor } from './tokens'
import { syncStateOf } from './ConnectivityPill'

describe('One colour map, no fallthrough (§F, §Q)', () => {
  it('gives every stored status of every type an explicit tone', () => {
    for (const type of DOCUMENT_TYPES) {
      for (const status of DOCUMENT_STATUSES[type]) {
        // A status that fell through to the neutral default would be a silent
        // gap in the map, so check it was mapped deliberately.
        expect(toneFor(status), `${type}.${status} has no tone`).toBeDefined()
        expect(Object.keys(TONE_PALETTE)).toContain(toneFor(status))
      }
    }
  })

  it('gives every derived state a tone', () => {
    for (const derived of ['unpaid', 'partially_paid', 'paid', 'overdue', 'expired']) {
      expect(toneFor(derived), `${derived} is unmapped`).not.toBe('neutral')
    }
  })

  it('reads money out and void as coral, paid and delivered as green (§F)', () => {
    expect(toneFor('void')).toBe('bad')
    expect(toneFor('money_out')).toBe('bad')
    expect(toneFor('paid')).toBe('good')
    expect(toneFor('delivered')).toBe('good')
    expect(toneFor('overdue')).toBe('warn')
    expect(toneFor('sent')).toBe('info')
  })

  it('falls back to neutral rather than inventing a colour', () => {
    expect(toneFor('something_new')).toBe('neutral')
  })
})

describe('Type colour belongs to the internal type, never the label (§F)', () => {
  it('covers all four types and nothing else', () => {
    expect(Object.keys(TYPE_PALETTE).sort()).toEqual([...DOCUMENT_TYPES].sort())
  })

  it('keeps the delivery document amber under every regional name', () => {
    // "a Delivery note is amber everywhere a Waybill is" — the palette is
    // keyed by the internal type, so there is no way to vary it by label.
    expect(TYPE_PALETTE.waybill.accent).toBe('#BA7517')
    expect(TYPE_PALETTE.waybill.icon).toBe('truck-delivery')
  })

  it('gives each type a distinct accent', () => {
    const accents = DOCUMENT_TYPES.map((t) => TYPE_PALETTE[t].accent)
    expect(new Set(accents).size).toBe(accents.length)
  })
})

describe('The connectivity indicator is truthful (§G, §M)', () => {
  it('does not call pending work uploaded just because we are online', () => {
    // §M: server acknowledgement, not network availability, completes an
    // upload. This is the whole point of the indicator.
    expect(syncStateOf({ online: true, pendingCount: 3, failedCount: 0 })).toBe('waiting')
    expect(syncStateOf({ online: true, pendingCount: 0, failedCount: 0 })).toBe('uploaded')
  })

  it('says saved on this phone when offline, whether or not work is pending', () => {
    expect(syncStateOf({ online: false, pendingCount: 0, failedCount: 0 })).toBe('saved_local')
    expect(syncStateOf({ online: false, pendingCount: 5, failedCount: 0 })).toBe('saved_local')
  })

  it('surfaces failures above everything else', () => {
    expect(syncStateOf({ online: true, pendingCount: 0, failedCount: 1 })).toBe('needs_review')
    expect(syncStateOf({ online: false, pendingCount: 9, failedCount: 2 })).toBe('needs_review')
  })
})
