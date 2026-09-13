/**
 * `runExport` — the decision layer between the archive and the share sheet.
 *
 * This file exists because two mutations survived without it: handing over an
 * incomplete archive, and reporting a dismissed share as a success. Both are
 * lies told to somebody deciding whether their records are safe, and neither
 * was visible from the archive tests or the panel tests — the seam between
 * them had nothing testing it at all.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { MemoryState } from '../../data/repositories'
import type { Repositories } from '../../data/repositories/types'
import type { ShareCapability, SharePort, ShareResult } from '../../share/port'
import { runExport } from './action'

const COMPANY = 'co_1'

const state = (): MemoryState => ({
  ...emptyState(),
  companies: [
    {
      id: COMPANY,
      name: 'Dynamic Renaissance Ltd',
      localeRegion: 'NG',
      localeLanguage: 'en',
      labelOverrides: {},
      currency: 'NGN',
      numberingPrefixes: {},
      bankFields: {},
      enabledPaymentMethods: [],
      nameStyle: 'classic',
      logoSize: 'M',
    },
  ],
})

const ALL: ShareCapability = { sheet: true, files: true, clipboard: true }

function port(result: ShareResult, capability: ShareCapability = ALL) {
  const sent: { title: string; text: string; fileName?: string }[] = []
  const value: SharePort = {
    capability: () => capability,
    share: async (payload) => {
      sent.push({
        title: payload.title,
        text: payload.text,
        ...(payload.file === undefined ? {} : { fileName: payload.file.name }),
      })
      return result
    },
  }
  return { port: value, sent }
}

const broken = (): Repositories => ({
  ...createMemoryRepositories(state()),
  payments: {
    ...createMemoryRepositories(state()).payments,
    listForCompany: async () => {
      throw new Error('the disk is full')
    },
  },
})

const at = () => new Date('2026-09-13T10:00:00.000Z')

describe('An incomplete archive is never handed over', () => {
  it('does not share it, and says why', async () => {
    const { port: share, sent } = port({ outcome: 'handed_off', channel: 'sheet' })

    const outcome = await runExport(broken(), COMPANY, share, at)

    expect(outcome.kind).toBe('incomplete')
    // The share was never attempted. An owner who receives a file believes it
    // whole — there is no second chance to add a caveat later.
    expect(sent).toEqual([])
  })
})

describe('What actually happened is what gets reported', () => {
  it('calls a dismissed share a failure, not a success', async () => {
    // The person changed their mind, so no file exists. Saying "Exported"
    // here is a claim about a file that was never written.
    const { port: share } = port({ outcome: 'dismissed', channel: 'sheet' })

    const outcome = await runExport(createMemoryRepositories(state()), COMPANY, share, at)

    expect(outcome.kind).toBe('failed')
    expect(outcome).toHaveProperty('reason', 'dismissed')
  })

  it('distinguishes a file handed to the sheet from text on the clipboard', async () => {
    const viaSheet = await runExport(
      createMemoryRepositories(state()),
      COMPANY,
      port({ outcome: 'handed_off', channel: 'sheet' }).port,
      at,
    )
    const viaClipboard = await runExport(
      createMemoryRepositories(state()),
      COMPANY,
      port({ outcome: 'handed_off', channel: 'clipboard' }).port,
      at,
    )

    expect(viaSheet.kind).toBe('shared')
    expect(viaClipboard.kind).toBe('copied')
  })

  it('reports a failed share with its reason', async () => {
    const { port: share } = port({ outcome: 'failed', channel: 'sheet', reason: 'no space' })

    const outcome = await runExport(createMemoryRepositories(state()), COMPANY, share, at)

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'no space' })
  })

  it('says so plainly when the device can neither share nor copy (§N)', async () => {
    const { port: share, sent } = port(
      { outcome: 'unavailable', channel: 'none' },
      { sheet: false, files: false, clipboard: false },
    )

    const outcome = await runExport(createMemoryRepositories(state()), COMPANY, share, at)

    expect(outcome.kind).toBe('unavailable')
    expect(sent).toEqual([])
  })
})

describe('What goes out', () => {
  it('attaches the archive as a named JSON file where files are possible', async () => {
    const { port: share, sent } = port({ outcome: 'handed_off', channel: 'sheet' })

    await runExport(createMemoryRepositories(state()), COMPANY, share, at)

    expect(sent[0]?.fileName).toBe('docflow-export-2026-09-13.json')
    expect(JSON.parse(sent[0]?.text ?? '')).toHaveProperty('meta.archiveVersion')
  })

  it('still sends the text where files are not', async () => {
    const { port: share, sent } = port(
      { outcome: 'handed_off', channel: 'clipboard' },
      { sheet: false, files: false, clipboard: true },
    )

    await runExport(createMemoryRepositories(state()), COMPANY, share, at)

    expect(sent[0]?.fileName).toBeUndefined()
    expect(sent[0]?.text).toContain('archiveVersion')
  })
})
