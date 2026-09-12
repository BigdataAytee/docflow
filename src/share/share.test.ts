/**
 * The share port, its text and its events (§B, §D, §M).
 *
 * The rule every test here circles: "A share handoff records a sharing event;
 * it never claims recipient delivery."
 */

import { describe, expect, it, vi } from 'vitest'

import { money } from '../domain/money/money'
import type { FrozenLabels } from '../domain/documents/types'
import { format } from '../domain/locale/data/strings'
import {
  NO_CAPABILITY,
  type ShareResult,
  unavailableSharePort,
} from './port'
import { type ShareEnvironment, createWebSharePort } from './web'
import { SHARE_ACTIONS, lastShared, shareCount, shareEventFor, wasShared } from './events'
import { sentenceCase, shareFileName, shareTextFor } from './text'

const NGN = (m: number) => money('NGN', m)

const STRINGS = {
  line: '{label} {reference}',
  forCustomer: 'For {customer}',
  totalLine: 'Total {amount}',
  outstandingLine: '{amount} still outstanding',
  dueLine: 'Due {due}',
  fromBusiness: '— {business}',
}

const frozen = (printedTitle: string, language = 'en'): FrozenLabels => ({
  printedTitle,
  partyLabel: 'Bill to',
  signatureCaption: 'Authorised signature',
  language,
})

const text = (over: Partial<Parameters<typeof shareTextFor>[0]['document']> = {}) =>
  shareTextFor({
    document: {
      type: 'invoice',
      reference: 'INV-0042',
      frozenLabels: frozen('INVOICE'),
      ...over,
    },
    businessName: 'Sola Ventures',
    profile: { locale: 'EN-NG' },
    strings: STRINGS,
    formatAmount: (amount) => `₦${(amount.minor / 100).toLocaleString('en-NG')}`,
    fill: format,
  })

describe('What goes out (§D, Rule #5)', () => {
  it('names the document by its own printed title and reference', () => {
    // Sentence case, not the page's shouting capitals: a message is not a page.
    expect(text().title).toBe('Invoice INV-0042')
  })

  it('uses the FROZEN title, so a shared document never changes language', () => {
    // Issued in Lagos as a waybill; the company has since moved to the UK.
    const moved = shareTextFor({
      document: {
        type: 'waybill',
        reference: 'WB-0007',
        frozenLabels: frozen('WAYBILL'),
      },
      businessName: 'Sola Ventures',
      profile: { locale: 'EN-GB' },
      strings: STRINGS,
      formatAmount: (amount) => String(amount.minor),
      fill: format,
    })
    expect(moved.title).toBe('Waybill WB-0007')
    expect(moved.title).not.toContain('Delivery note')
  })

  it('falls back to the live label for a draft, which has frozen none', () => {
    const draft = shareTextFor({
      document: { type: 'waybill', reference: null, frozenLabels: null },
      businessName: 'Sola Ventures',
      profile: { locale: 'EN-GB' },
      strings: STRINGS,
      formatAmount: (amount) => String(amount.minor),
      fill: format,
    })
    // EN-GB calls it a delivery note, and nothing is frozen to say otherwise.
    expect(draft.title).toContain('Delivery note')
  })

  it('names the customer and the total when there are any', () => {
    const composed = text({ customerName: 'Ade Stores', total: NGN(145_000_00) })
    expect(composed.body).toContain('For Ade Stores')
    expect(composed.body).toContain('Total ₦145,000')
    expect(composed.body).toContain('— Sola Ventures')
  })

  it('asks for what is outstanding, with the due date', () => {
    const composed = text({
      total: NGN(145_000_00),
      outstanding: NGN(95_000_00),
      dueDate: '2026-09-30',
    })
    expect(composed.body).toContain('₦95,000 still outstanding')
    expect(composed.body).toContain('Due 2026-09-30')
  })

  it('never attaches a demand to a settled invoice', () => {
    const composed = text({ total: NGN(145_000_00), outstanding: NGN(0), dueDate: '2026-09-30' })
    expect(composed.body).not.toContain('outstanding')
    expect(composed.body).not.toContain('Due')
  })

  it('carries no money at all for a delivery document', () => {
    const composed = shareTextFor({
      document: { type: 'waybill', reference: 'WB-0007', frozenLabels: frozen('WAYBILL') },
      businessName: 'Sola Ventures',
      profile: { locale: 'EN-NG' },
      strings: STRINGS,
      formatAmount: (amount) => String(amount.minor),
      fill: format,
    })
    expect(composed.body).not.toContain('Total')
    expect(composed.body).not.toContain('outstanding')
  })

  it('makes a filename safe, and falls back when there is no reference', () => {
    expect(shareFileName('INV-0042', 'document')).toBe('INV-0042.pdf')
    expect(shareFileName('INV/0042 draft', 'document')).toBe('INV-0042-draft.pdf')
    expect(shareFileName(null, 'document')).toBe('document.pdf')
  })
})

describe('Casing is presentation; the word is not (§D.2, §I)', () => {
  it('softens the printed capitals without changing the word', () => {
    expect(sentenceCase('DELIVERY NOTE', 'en')).toBe('Delivery note')
    expect(sentenceCase('BON DE LIVRAISON', 'fr')).toBe('Bon de livraison')
    expect(sentenceCase('COTIZACIÓN', 'es')).toBe('Cotización')
  })

  it('leaves a script without case alone', () => {
    expect(sentenceCase('بوليصة شحن', 'ar')).toBe('بوليصة شحن')
  })

  it('survives an empty title rather than throwing', () => {
    expect(sentenceCase('', 'en')).toBe('')
  })
})

describe('The platform is asked, never assumed (§N)', () => {
  const environment = (over: Partial<ShareEnvironment> = {}): ShareEnvironment => ({ ...over })

  it('reports nothing when the platform can do nothing', () => {
    const port = createWebSharePort(environment())
    expect(port.capability()).toEqual(NO_CAPABILITY)
  })

  it('reports the sheet without files when canShare is absent', () => {
    const port = createWebSharePort(environment({ share: async () => undefined }))
    expect(port.capability()).toEqual({ sheet: true, files: false, clipboard: false })
  })

  it('reports files only when canShare says so', () => {
    const port = createWebSharePort(
      environment({
        share: async () => undefined,
        canShare: () => true,
        file: (bytes, name, mimeType) => new File([new Uint8Array(bytes)], name, { type: mimeType }),
      }),
    )
    expect(port.capability().files).toBe(true)
  })

  it('reports the clipboard on its own', () => {
    const port = createWebSharePort(environment({ writeText: async () => undefined }))
    expect(port.capability()).toEqual({ sheet: false, files: false, clipboard: true })
  })

  it('does nothing, loudly, when there is no way to share', async () => {
    const result = await createWebSharePort(environment()).share({ title: 'a', text: 'b' })
    expect(result).toEqual({ outcome: 'unavailable', channel: 'none' })
  })

  it('the unavailable port is honest rather than throwing', async () => {
    expect(unavailableSharePort.capability()).toEqual(NO_CAPABILITY)
    expect(await unavailableSharePort.share({ title: 'a', text: 'b' })).toEqual({
      outcome: 'unavailable',
      channel: 'none',
    })
  })
})

describe('A handoff is a handoff (§M)', () => {
  it('hands the title and text to the sheet', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    const result = await createWebSharePort({ share }).share({ title: 'INVOICE', text: 'body' })

    expect(share).toHaveBeenCalledWith({ title: 'INVOICE', text: 'body' })
    expect(result).toEqual({ outcome: 'handed_off', channel: 'sheet' })
  })

  it('reads a dismissed sheet as dismissed, not as a failure', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    const result = await createWebSharePort({
      share: async () => {
        throw abort
      },
    }).share({ title: 'a', text: 'b' })

    expect(result).toEqual({ outcome: 'dismissed', channel: 'sheet' })
  })

  it('reads a refused sheet as a failure, not as a dismissal', async () => {
    // NotAllowedError means the platform said no. Calling that "you cancelled"
    // would hide a real problem behind the owner's own choice.
    const refused = Object.assign(new Error('gesture required'), { name: 'NotAllowedError' })
    const result = await createWebSharePort({
      share: async () => {
        throw refused
      },
    }).share({ title: 'a', text: 'b' })

    expect(result.outcome).toBe('failed')
    expect(result.reason).toBe('gesture required')
  })

  it('falls back to the clipboard rather than losing the document', async () => {
    const writeText = vi.fn(async () => undefined)
    const result = await createWebSharePort({
      share: async () => {
        throw new Error('no sheet today')
      },
      writeText,
    }).share({ title: 'a', text: 'the body' })

    expect(writeText).toHaveBeenCalledWith('the body')
    expect(result).toEqual({ outcome: 'handed_off', channel: 'clipboard' })
  })

  it('does not fall back after a dismissal — that was a decision', async () => {
    const writeText = vi.fn(async () => undefined)
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    await createWebSharePort({
      share: async () => {
        throw abort
      },
      writeText,
    }).share({ title: 'a', text: 'b' })

    expect(writeText).not.toHaveBeenCalled()
  })

  it('attaches a file only when the platform accepts one', async () => {
    // Typed, so the assertions below can read the arguments the port passed.
    const share = vi.fn(async (_data: ShareData) => undefined)
    const bytes = new Uint8Array([1, 2, 3])

    const withoutFiles = createWebSharePort({ share })
    await withoutFiles.share({
      title: 'a',
      text: 'b',
      file: { name: 'x.pdf', mimeType: 'application/pdf', bytes },
    })
    expect(share.mock.calls[0]?.[0]).not.toHaveProperty('files')

    const withFiles = createWebSharePort({
      share,
      canShare: () => true,
      file: (raw, name, mimeType) => new File([new Uint8Array(raw)], name, { type: mimeType }),
    })
    await withFiles.share({
      title: 'a',
      text: 'b',
      file: { name: 'x.pdf', mimeType: 'application/pdf', bytes },
    })
    expect(share.mock.calls[1]?.[0]).toHaveProperty('files')
  })
})

describe('The sharing event never says delivered (§M, §E)', () => {
  const event = (result: ShareResult) =>
    shareEventFor({
      id: 'shr_1',
      companyId: 'co_1',
      documentId: 'doc_1',
      at: '2026-09-12T10:00:00Z',
      result,
      deviceId: 'dev_a',
    })

  it('has no action that could mean delivered, received or read', () => {
    // The type system holds this shut; the test states it so a future edit
    // that adds one has to argue with a named expectation.
    expect([...SHARE_ACTIONS]).toEqual(['shared', 'share_dismissed', 'share_failed'])
  })

  it('records a handoff against the document, as an audit row', () => {
    const recorded = event({ outcome: 'handed_off', channel: 'sheet' })
    expect(recorded).toMatchObject({
      action: 'shared',
      entity: 'document',
      recordId: 'doc_1',
      channel: 'sheet',
      deviceId: 'dev_a',
    })
    expect(Object.isFrozen(recorded)).toBe(true)
  })

  it('records a dismissal and a failure as themselves', () => {
    expect(event({ outcome: 'dismissed', channel: 'sheet' })?.action).toBe('share_dismissed')
    expect(event({ outcome: 'failed', channel: 'sheet' })?.action).toBe('share_failed')
  })

  it('records nothing when nothing was attempted', () => {
    expect(event({ outcome: 'unavailable', channel: 'none' })).toBeNull()
  })

  it('never carries a recipient — there is no field for one', () => {
    const recorded = event({ outcome: 'handed_off', channel: 'sheet' })
    expect(recorded).not.toHaveProperty('recipient')
    expect(recorded).not.toHaveProperty('deliveredAt')
    expect(Object.keys(recorded ?? {})).not.toContain('to')
  })

  it('counts handoffs, and only handoffs', () => {
    const events = [
      event({ outcome: 'handed_off', channel: 'sheet' }),
      event({ outcome: 'handed_off', channel: 'clipboard' }),
      event({ outcome: 'dismissed', channel: 'sheet' }),
      event({ outcome: 'failed', channel: 'sheet' }),
    ].flatMap((row) => (row === null ? [] : [row]))

    expect(shareCount(events, 'doc_1')).toBe(2)
    expect(wasShared(events, 'doc_1')).toBe(true)
    expect(wasShared(events, 'doc_2')).toBe(false)
  })

  it('finds the most recent handoff', () => {
    const early = shareEventFor({
      id: 'shr_1',
      companyId: 'co_1',
      documentId: 'doc_1',
      at: '2026-09-01T10:00:00Z',
      result: { outcome: 'handed_off', channel: 'sheet' },
    })
    const late = shareEventFor({
      id: 'shr_2',
      companyId: 'co_1',
      documentId: 'doc_1',
      at: '2026-09-12T10:00:00Z',
      result: { outcome: 'handed_off', channel: 'sheet' },
    })
    const events = [late, early].flatMap((row) => (row === null ? [] : [row]))
    expect(lastShared(events, 'doc_1')?.id).toBe('shr_2')
    expect(lastShared(events, 'doc_2')).toBeNull()
  })
})
