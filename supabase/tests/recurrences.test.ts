/**
 * Monthly repeats, against a real Postgres (§L4, §P).
 *
 * This file is the reason the table waited. `rls.test.ts` asserts RLS enabled
 * AND forced on every table, so it catches a table shipped with no policy and
 * a malformed one — and it cannot catch a policy that is present, well formed
 * and SUBTLY WRONG. That one passes every assertion and leaks across
 * companies. So the policy had to be written where this could be run, and
 * these are the specific denials that make it more than a formality.
 *
 * Two shapes are tested that the generic suite does not reach:
 *
 *  · the CROSS-COMPANY WRITE THAT LOOKS LEGITIMATE — a row carrying your own
 *    company id, pointing at somebody else's document. RLS scopes the row by
 *    its own `company_id` and would allow it; the trigger is what refuses.
 *  · the RECURRENCE KEY'S UNIQUE INDEX, which is what makes catch-up
 *    idempotent across a crash. An index is not a nicety here: two racing
 *    catch-ups can both pass a SELECT and cannot both win a UNIQUE.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { applyMigrations, asCompany, connectionString } from './apply'

const ACME = '11111111-1111-1111-1111-111111111111'
const RIVAL = '22222222-2222-2222-2222-222222222222'
const ACME_DOC = 'dddddddd-1111-0000-0000-000000000001'
const RIVAL_DOC = 'dddddddd-2222-0000-0000-000000000001'

let db: Client

beforeAll(async () => {
  db = new Client({ connectionString: connectionString() })
  await db.connect()
  await applyMigrations(db)

  await db.query('set role service_role')
  await db.query(
    `insert into public.companies (id, name, currency, locale_region)
     values ($1, 'Dynamic Renaissance', 'NGN', 'NG'), ($2, 'Rival Traders', 'NGN', 'NG')
     on conflict (id) do nothing`,
    [ACME, RIVAL],
  )
  await db.query(
    `insert into public.documents (id, company_id, type, status, currency, total_minor) values
       ($1, $3, 'invoice', 'issued', 'NGN', 14500000),
       ($2, $4, 'invoice', 'issued', 'NGN', 9900000)
     on conflict (id) do nothing`,
    [ACME_DOC, RIVAL_DOC, ACME, RIVAL],
  )
  await db.query('reset role')
}, 60_000)

afterAll(async () => {
  await db?.end()
})

describe('A repeat belongs to one company (§P)', () => {
  it('is written and read back by its owner', async () => {
    await asCompany(db, ACME, async () => {
      await db.query(
        `insert into public.recurrences
           (source_document_id, company_id, day_of_month, started_on)
         values ($1, $2, 5, date '2026-09-15')
         on conflict (source_document_id) do update set day_of_month = excluded.day_of_month`,
        [ACME_DOC, ACME],
      )
      const { rows } = await db.query('select * from public.recurrences')
      expect(rows).toHaveLength(1)
      expect(rows[0].day_of_month).toBe(5)
    })
  })

  it('is invisible to another company', async () => {
    await asCompany(db, RIVAL, async () => {
      const { rows } = await db.query('select * from public.recurrences')
      expect(rows).toEqual([])
    })
  })

  it('cannot be updated by another company', async () => {
    await asCompany(db, RIVAL, async () => {
      const { rowCount } = await db.query(
        `update public.recurrences set ended_on = date '2026-10-01' where source_document_id = $1`,
        [ACME_DOC],
      )
      // Not an error — RLS makes the row invisible, so the update matches
      // nothing. The repository turns this into a named failure rather than
      // reporting a success over a row it never touched.
      expect(rowCount).toBe(0)
    })
  })

  it('cannot be deleted by another company', async () => {
    await asCompany(db, RIVAL, async () => {
      const { rowCount } = await db.query(
        'delete from public.recurrences where source_document_id = $1',
        [ACME_DOC],
      )
      expect(rowCount).toBe(0)
    })
  })

  /** An anonymous caller has no claim at all, so every policy denies. */
  it('is invisible with no claim', async () => {
    await asCompany(db, null, async () => {
      const { rows } = await db.query('select * from public.recurrences')
      expect(rows).toEqual([])
    })
  })

  /** The row cannot be written INTO another company either. */
  it('refuses a row stamped with somebody else’s company', async () => {
    await asCompany(db, RIVAL, async () => {
      await expect(
        db.query(
          `insert into public.recurrences
             (source_document_id, company_id, day_of_month, started_on)
           values ($1, $2, 9, date '2026-09-15')`,
          [RIVAL_DOC, ACME],
        ),
      ).rejects.toThrow(/row-level security/i)
    })
  })
})

describe('A repeat may only name its own company’s document (§P)', () => {
  /**
   * THE HOLE RLS DOES NOT CLOSE, and the reason the trigger exists.
   *
   * The policy scopes the row by the row's own `company_id`. A caller writing
   * their OWN company id onto a schedule that points at somebody else's
   * document satisfies it exactly — the row is theirs, so `using` and `with
   * check` both pass. What it would give them is a monthly copy of a stranger's
   * invoice, which is the whole of what §L4 produces.
   *
   * Row-level security answers "may I write this row". It does not answer "is
   * this row internally consistent".
   */
  it('refuses a schedule pointing at another company’s document', async () => {
    await asCompany(db, RIVAL, async () => {
      await expect(
        db.query(
          `insert into public.recurrences
             (source_document_id, company_id, day_of_month, started_on)
           values ($1, $2, 9, date '2026-09-15')`,
          // The row is RIVAL's; the document is ACME's.
          [ACME_DOC, RIVAL],
        ),
      ).rejects.toThrow(/same company/i)
    })
  })

  it('refuses the same move by update', async () => {
    await asCompany(db, RIVAL, async () => {
      await db.query(
        `insert into public.recurrences
           (source_document_id, company_id, day_of_month, started_on)
         values ($1, $2, 9, date '2026-09-15')
         on conflict (source_document_id) do nothing`,
        [RIVAL_DOC, RIVAL],
      )
      await expect(
        db.query(
          `update public.recurrences set source_document_id = $1 where source_document_id = $2`,
          [ACME_DOC, RIVAL_DOC],
        ),
      ).rejects.toThrow(/same company/i)
    })
  })
})

describe('One document has one schedule (§L4)', () => {
  it('upserts rather than making a second row', async () => {
    await asCompany(db, ACME, async () => {
      await db.query(
        `insert into public.recurrences
           (source_document_id, company_id, day_of_month, started_on, ended_on)
         values ($1, $2, 28, date '2026-09-15', null)
         on conflict (source_document_id)
         do update set day_of_month = excluded.day_of_month, ended_on = excluded.ended_on`,
        [ACME_DOC, ACME],
      )
      const { rows } = await db.query(
        'select * from public.recurrences where source_document_id = $1',
        [ACME_DOC],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].day_of_month).toBe(28)
      // Re-starting a stopped schedule clears the end date, or the row would
      // say it ended while the toggle said it was on.
      expect(rows[0].ended_on).toBeNull()
    })
  })

  it('refuses a day that is not a day of the month', async () => {
    await asCompany(db, ACME, async () => {
      await expect(
        db.query(
          `insert into public.recurrences
             (source_document_id, company_id, day_of_month, started_on)
           values ($1, $2, 32, date '2026-09-15')
           on conflict (source_document_id) do update set day_of_month = excluded.day_of_month`,
          [ACME_DOC, ACME],
        ),
      ).rejects.toThrow()
    })
  })
})

describe('The recurrence key is what makes catch-up idempotent (§L4)', () => {
  /**
   * A run that died halfway finds its own earlier drafts by key and creates
   * only what is still missing. Two racing runs can both pass a SELECT; they
   * cannot both win a UNIQUE constraint.
   */
  it('refuses a second document for the same period', async () => {
    await db.query('set role service_role')
    try {
      await db.query(
        `insert into public.documents
           (id, company_id, type, status, currency, total_minor, recurrence_key)
         values ('dddddddd-3333-0000-0000-000000000001', $1, 'invoice', 'draft', 'NGN', 0, $2)`,
        [ACME, `${ACME_DOC}:2026-10`],
      )
      await expect(
        db.query(
          `insert into public.documents
             (id, company_id, type, status, currency, total_minor, recurrence_key)
           values ('dddddddd-3333-0000-0000-000000000002', $1, 'invoice', 'draft', 'NGN', 0, $2)`,
          [ACME, `${ACME_DOC}:2026-10`],
        ),
      ).rejects.toThrow(/duplicate key|unique/i)
    } finally {
      await db.query('reset role')
    }
  })

  /**
   * PARTIAL, and it has to be. Every document somebody made themselves
   * carries a null key, and a plain unique index would let exactly one
   * hand-made document exist per company.
   */
  it('lets any number of hand-made documents carry no key at all', async () => {
    await db.query('set role service_role')
    try {
      await db.query(
        `insert into public.documents (id, company_id, type, status, currency, total_minor) values
           ('dddddddd-4444-0000-0000-000000000001', $1, 'invoice', 'draft', 'NGN', 0),
           ('dddddddd-4444-0000-0000-000000000002', $1, 'invoice', 'draft', 'NGN', 0)`,
        [ACME],
      )
      const { rows } = await db.query(
        'select count(*)::int as n from public.documents where recurrence_key is null and company_id = $1',
        [ACME],
      )
      expect(rows[0].n).toBeGreaterThanOrEqual(2)
    } finally {
      await db.query('reset role')
    }
  })
})
