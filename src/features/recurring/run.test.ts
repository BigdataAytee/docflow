/**
 * The catch-up, against real repositories (§L4, §M).
 *
 * `schedule.test.ts` covers the arithmetic. This covers the part that writes,
 * and it runs against the in-memory store AND SQLite, because "no duplicates"
 * is a claim about a database and not about a function.
 *
 * Every case here asserts what was PRODUCED, never merely that nothing threw.
 * A catch-up that quietly did nothing would satisfy "did not duplicate"
 * perfectly, which is the same shape as a bundle scan passing because there
 * was no bundle — so each test names the months it expects and fails if they
 * are missing as loudly as if they were doubled.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { DocumentRecord, Repositories } from '../../data/repositories'
import { HARNESSES, type RepositoryHarness } from '../../data/repositories/harness'
import { quantity } from '../../domain/documents/types'
import { freezeLabels } from '../../domain/locale/profile'
import { CATCH_UP_LIMIT, recurrenceKeyFor } from './schedule'
import { runCatchUp } from './run'

const ACME = 'co_acme'
const PROFILE = { locale: 'EN-NG' } as const

for (const harness of HARNESSES) {
  describe(harness.name, () => {
    contract(harness)
  })
}

function contract(harness: RepositoryHarness): void {
  let repos: Repositories
  let dispose: () => Promise<void>

  beforeEach(async () => {
    const store = await harness.create([ACME])
    repos = store.repositories
    dispose = store.dispose
  })

  afterEach(async () => {
    await dispose()
  })

  /** An issued invoice with a repeat switched on from it. */
  const repeating = async (startedOn = '2026-01-10'): Promise<DocumentRecord> => {
    const source = await repos.documents.createDraft(
      {
        companyId: ACME,
        type: 'invoice',
        status: 'draft',
        currency: 'NGN',
        lineItems: [
          {
            id: 'l1',
            description: 'Monthly retainer',
            quantityMilli: quantity(1),
            unitPriceMinor: 250_000_00,
            taxable: true,
          },
        ],
        totalMinor: 250_000_00,
        issueDate: startedOn,
        templateId: 'aurora',
        brandColour: '#0F6E56',
      },
      { idempotencyKey: 'src' },
    )
    const issued = await repos.documents.issue(
      source.id,
      {
        reference: 'INV-0001',
        frozenLabels: freezeLabels(PROFILE, 'invoice'),
        totalMinor: 250_000_00,
      },
      { idempotencyKey: 'src-issue' },
    )
    await repos.recurrences.start(
      { companyId: ACME, sourceDocumentId: source.id, dayOfMonth: 10, startedOn },
      { idempotencyKey: `rep:${source.id}` },
    )
    return issued
  }

  /** Every recurrence key the device now holds, which is what catch-up reads. */
  const keysOnDevice = async (): Promise<string[]> =>
    (await repos.documents.listByType(ACME, 'invoice'))
      .flatMap((row) => (row.recurrenceKey === undefined ? [] : [row.recurrenceKey]))
      .sort()

  describe('What a catch-up produces', () => {
    it('creates one draft per missed month, and dates each on the repeat day', async () => {
      const source = await repeating('2026-01-10')

      const { created, skipped } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-04-15',
      })

      // The source covers January itself, so February, March and April are due.
      expect(created.map((row) => row.issueDate)).toEqual([
        '2026-02-10',
        '2026-03-10',
        '2026-04-10',
      ])
      expect(created.map((row) => row.recurrenceKey)).toEqual([
        recurrenceKeyFor(source.id, '2026-02'),
        recurrenceKeyFor(source.id, '2026-03'),
        recurrenceKeyFor(source.id, '2026-04'),
      ])
      expect(skipped).toEqual([])
    })

    /**
     * §L4: "reviewable monthly drafts". §A: nothing sent unseen. A recurring
     * invoice that issued itself would freeze a reference and a label onto a
     * document nobody had looked at — and Rule #5 means that could then never
     * be corrected, only voided.
     */
    it('issues nothing, numbers nothing, and sends nothing', async () => {
      await repeating('2026-01-10')

      const { created } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-03-15',
      })

      expect(created).toHaveLength(2)
      for (const draft of created) {
        expect(draft.status).toBe('draft')
        expect(draft.issuedReference).toBeNull()
        expect(draft.frozenLabels).toBeNull()
      }
      // And no share was recorded by any of it.
      expect(await repos.shares.list(ACME)).toEqual([])
    })

    it('carries the design over, so a repeat looks like what it repeats', async () => {
      await repeating('2026-01-10')
      const { created } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-02-15',
      })
      expect(created[0]?.templateId).toBe('aurora')
      expect(created[0]?.brandColour).toBe('#0F6E56')
    })

    it('says which months it skipped rather than dropping them quietly', async () => {
      await repeating('2020-01-10')

      const { created, skipped } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-04-15',
      })

      expect(created).toHaveLength(CATCH_UP_LIMIT)
      expect(skipped.length).toBeGreaterThan(0)
      // Oldest first, and genuinely older than what was created.
      expect(skipped[0]).toBe('2020-02')
      expect(skipped.at(-1)! < (created[0]?.issueDate ?? '')).toBe(true)
    })

    it('produces nothing after Repeat is switched off', async () => {
      const source = await repeating('2026-01-10')
      await repos.recurrences.stop(ACME, source.id, '2026-02-01', { idempotencyKey: 'stop' })

      const { created } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-06-15',
      })

      // February alone: the schedule ended inside it, and nothing after.
      expect(created.map((row) => row.issueDate)).toEqual(['2026-02-10'])
    })
  })

  describe('A catch-up killed halfway does not duplicate (§M)', () => {
    /**
     * The failure this is really about: a phone opened after a long gap starts
     * writing the months it owes and dies partway — the process is killed, the
     * battery goes, the OS reclaims the app. On the next launch the catch-up
     * runs again from the beginning.
     *
     * The kill is modelled by running the catch-up against a repository that
     * throws once a set number of drafts have been written. That is a REAL
     * partial write: the drafts before the throw are committed and the ones
     * after never happened, which is exactly the state a killed process
     * leaves behind.
     *
     * Both halves are asserted. A re-run that produced nothing at all would
     * pass a duplicate check trivially, so the months present at the end are
     * compared against the months that were due — the test fails as loudly
     * for a catch-up that gave up as for one that doubled.
     */
    it('resumes, completes the months it owed, and writes each exactly once', async () => {
      const source = await repeating('2026-01-10')
      const DIED_AFTER = 2

      let written = 0
      const flaky: Repositories = {
        ...repos,
        documents: {
          ...repos.documents,
          createDraft: async (draft, ctx) => {
            if (written >= DIED_AFTER) throw new Error('killed mid-catch-up')
            written += 1
            return repos.documents.createDraft(draft, ctx)
          },
        },
      }

      await expect(
        runCatchUp({ repositories: flaky, companyId: ACME, today: '2026-06-15' }),
      ).rejects.toThrow('killed mid-catch-up')

      // The partial write really happened — otherwise the re-run below would
      // be proving nothing about resuming.
      const afterCrash = await keysOnDevice()
      expect(afterCrash).toHaveLength(DIED_AFTER)

      // Next launch. Same schedule, same day, no memory of the dead run.
      const { created } = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-06-15',
      })

      // It did work — it finished the three months the crash never reached.
      expect(created).toHaveLength(3)

      const expected = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((month) =>
        recurrenceKeyFor(source.id, month),
      )
      const final = await keysOnDevice()

      // Every month owed is present...
      expect(final).toEqual([...expected].sort())
      // ...exactly once. `toEqual` above would catch a duplicate too, but this
      // says which invariant is being claimed.
      expect(new Set(final).size).toBe(final.length)
    })

    /**
     * The other direction: not a crash, but the same catch-up running twice
     * because two things asked for it — a launch and a resume, say. Nothing
     * is missing, so nothing should be created, and the drafts already there
     * must not be touched.
     */
    it('is a no-op when it has nothing left to owe', async () => {
      await repeating('2026-01-10')
      const first = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-04-15',
      })
      const after = await keysOnDevice()

      const second = await runCatchUp({
        repositories: repos,
        companyId: ACME,
        today: '2026-04-15',
      })

      expect(first.created).toHaveLength(3)
      expect(second.created).toEqual([])
      expect(await keysOnDevice()).toEqual(after)
    })

    /**
     * And the belt to that braces: even if the DECISION were somehow wrong —
     * a stale read, two devices, a replayed sync — the write itself refuses.
     * The recurrence key is the idempotency key, so asking twice returns what
     * was written the first time rather than a second row (§M).
     */
    it('writes one row even when the same period is asked for twice', async () => {
      const source = await repeating('2026-01-10')
      const key = recurrenceKeyFor(source.id, '2026-02')

      const draft = {
        companyId: ACME,
        type: 'invoice' as const,
        status: 'draft',
        currency: 'NGN',
        lineItems: [],
        totalMinor: 0,
        issueDate: '2026-02-10',
        recurrenceKey: key,
      }

      const once = await repos.documents.createDraft(draft, { idempotencyKey: key })
      const twice = await repos.documents.createDraft(draft, { idempotencyKey: key })

      expect(twice.id).toBe(once.id)
      expect(await keysOnDevice()).toEqual([key])
    })
  })
}
