/**
 * Full user data export, and reading it back (§Q Phase 7, Rule #6).
 *
 * Two properties carry this file. The export is COMPLETE or it says so — a
 * short archive that looks whole is the worst outcome, because the owner keeps
 * it and finds out when it is the only copy left. And it READS BACK: a backup
 * nobody has restored is not a backup.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { MemoryState } from '../../data/repositories'
import type { Repositories } from '../../data/repositories/types'
import { quantity } from '../../domain/documents/types'
import { ARCHIVE_VERSION, archiveFilename, archiveJson, exportArchive } from './archive'
import { readArchive, reportOf } from './restore'

const COMPANY = 'co_1'

function state(): MemoryState {
  return {
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
    customers: [
      { id: 'cu_1', companyId: COMPANY, kind: 'company', name: 'Okoro & Sons', labels: [] },
    ],
    documents: [
      {
        id: 'doc_1',
        companyId: COMPANY,
        type: 'invoice',
        status: 'sent',
        customerId: 'cu_1',
        currency: 'NGN',
        lineItems: [
          { id: 'li_1', description: 'Panels', quantityMilli: quantity(4), unitPriceMinor: 250_00, taxable: true },
        ],
        issuedReference: 'INV-0042',
        // Rule #5: an issued document carries the words it was issued under.
        frozenLabels: {
          printedTitle: 'INVOICE',
          partyLabel: 'Bill to',
          signatureCaption: 'AUTHORISED SIGNATURE',
          language: 'en',
        },
        totalMinor: 1_000_00,
      },
      {
        id: 'doc_2',
        companyId: COMPANY,
        type: 'waybill',
        status: 'dispatched',
        customerId: 'cu_1',
        currency: 'NGN',
        lineItems: [{ id: 'li_2', description: 'Panels', quantityMilli: quantity(4), taxable: false }],
        issuedReference: 'WAY-0007',
        frozenLabels: null,
        totalMinor: 0,
      },
    ],
    assets: [
      {
        id: 'as_1',
        companyId: COMPANY,
        kind: 'signature',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ],
  }
}

const repos = (over: Partial<Repositories> = {}): Repositories => ({
  ...createMemoryRepositories(state()),
  ...over,
})

const at = () => new Date('2026-09-13T10:00:00.000Z')

describe('The export is everything, or it says it is not', () => {
  it('carries every kind of record the app holds', async () => {
    const result = await exportArchive(repos(), COMPANY, at)

    expect(result.complete).toBe(true)
    expect(result.archive.company?.name).toBe('Dynamic Renaissance Ltd')
    expect(result.archive.customers).toHaveLength(1)
    // Both types, from separate per-type listings.
    expect(result.archive.documents.map((doc) => doc.id).sort()).toEqual(['doc_1', 'doc_2'])
    expect(result.archive.assets).toHaveLength(1)
  })

  it('is NOT complete when one part cannot be read, and names it', async () => {
    const broken = repos({
      payments: {
        ...createMemoryRepositories(state()).payments,
        listForCompany: async () => {
          throw new Error('the disk is full')
        },
      },
    })
    const result = await exportArchive(broken, COMPANY, at)

    expect(result.complete).toBe(false)
    expect(result.failed.map((entry) => entry.part)).toEqual(['payments'])
    expect(result.failed[0]?.reason).toContain('the disk is full')
    // And the rest still came out, so the report can say what was lost.
    expect(result.archive.customers).toHaveLength(1)
  })

  it('keeps money in minor units and labels frozen', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)
    const invoice = archive.documents.find((doc) => doc.id === 'doc_1')

    // Rule #3: integers, never a formatted string somebody has to parse back.
    expect(invoice?.totalMinor).toBe(1_000_00)
    expect(typeof invoice?.totalMinor).toBe('number')
    // Rule #5: the words it was issued under, not today's.
    expect(invoice?.frozenLabels?.printedTitle).toBe('INVOICE')
  })

  it('carries images inline, so the file needs nothing else', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)

    expect(archive.assets[0]?.dataUrl.startsWith('data:')).toBe(true)
  })

  it('says in the archive what it left out', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)
    const notes = archive.meta.notes.join(' ')

    // An owner should not have to guess. Link tokens are hashes and would
    // open nothing, so they are absent — and the archive says so.
    expect(notes).toContain('Public-link tokens are not included')
    expect(notes).toContain('smallest unit')
    expect(notes).toContain('free, on every plan, forever')
  })

  it('has no way to check a plan, so it cannot gate on one (Rule #6)', () => {
    // Rule #6: "full data export stays free forever". The durable version of
    // that is not a comment and not an arity check — it is that the export
    // path contains no entitlement vocabulary at all, so there is nothing to
    // branch on and nothing for a later change to start branching on.
    const source = [
      readFileSync(join(process.cwd(), 'src/features/export/archive.ts'), 'utf8'),
      readFileSync(join(process.cwd(), 'src/features/export/action.ts'), 'utf8'),
    ]
      .join('\n')
      // Comments explain the rule and strings state it to the owner — the
      // archive literally says "free, on every plan, forever". Neither can
      // gate anything. Only code can, so only code is searched.
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")

    for (const word of ['entitlement', 'subscription', 'isPro', 'plan', 'paywall', 'locked']) {
      expect(source.toLowerCase().includes(word.toLowerCase()), `export code mentions ${word}`).toBe(
        false,
      )
    }
  })

  it('names the file by its date, so two exports do not collide by accident', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)

    expect(archiveFilename(archive)).toBe('docflow-export-2026-09-13.json')
  })
})

describe('A backup nobody has restored is not a backup', () => {
  it('round-trips every record through JSON', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)
    const report = readArchive(archiveJson(archive))

    expect(report.problems).toEqual([])
    expect(report.readable).toBe(true)
    expect(report.archive?.documents).toHaveLength(2)
    // Identity, not merely "it parsed".
    expect(report.archive).toEqual(archive)
  })

  it('catches a truncated file that still parses', async () => {
    // The §V failure: "interrupted downloads and full-storage failures". A cut
    // in the right place leaves valid JSON holding fewer records, which is
    // otherwise indistinguishable from a smaller business.
    const { archive } = await exportArchive(repos(), COMPANY, at)
    const truncated = { ...archive, documents: archive.documents.slice(0, 1) }
    const report = readArchive(JSON.stringify(truncated))

    expect(report.readable).toBe(false)
    expect(report.problems[0]?.detail).toContain('truncated or edited')
    expect(reportOf(report)).toContain('NOT whole')
  })

  it('refuses a file that is not an archive at all', () => {
    expect(readArchive('not json{').readable).toBe(false)
    expect(readArchive('"a string"').readable).toBe(false)
    expect(readArchive('{}').readable).toBe(false)
  })

  it('reads an older archive and says which version it was', async () => {
    const { archive } = await exportArchive(repos(), COMPANY, at)
    const older = { ...archive, meta: { ...archive.meta, archiveVersion: ARCHIVE_VERSION - 1 } }
    const report = readArchive(JSON.stringify(older))

    // Not fatal: a reader should say what it can about an old file rather
    // than refusing the only copy somebody has.
    expect(report.problems.some((problem) => problem.part === 'meta')).toBe(true)
    expect(report.counts['documents']).toBe(2)
  })
})
