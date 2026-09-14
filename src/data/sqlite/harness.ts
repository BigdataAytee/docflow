/**
 * The SQLite store, as the contract suite sees it (§Q Phase 4).
 *
 * A fresh in-memory database per test, migrated, with the companies seeded by
 * direct INSERT rather than through a repository — there is no `createCompany`
 * on the contract, because a company is made by signing up (§R), not by a
 * screen.
 *
 * `:memory:` is not a compromise here. It is the same SQLite build, the same
 * statements and the same triggers as the file on the phone; only the pages
 * live in RAM instead of on flash. What it cannot show is encryption, and this
 * harness does not claim to — that is `capacitor.ts` on a device, and §Q puts
 * it in the Phase 1 gate for exactly that reason.
 *
 * Ids are minted deterministically so a failing case names the same row twice.
 */

import type { CountableTable, RepositoryHarness } from '../repositories/harness'
import { migrate } from './migrate'
import { createNodeDriver } from './node'
import { createSqliteRepositories } from './repositories'

const TABLE_OF: Readonly<Record<CountableTable, string>> = {
  payments: 'payments',
  linkTokens: 'link_tokens',
  assets: 'assets',
  documents: 'documents',
}

/** The record fields a stored token row maps to — §P: only ever the hash. */
const LINK_TOKEN_FIELD_OF: Readonly<Record<string, string>> = {
  document_id: 'documentId',
  company_id: 'companyId',
  token_hash: 'tokenHash',
  expires_at: 'expiresAt',
  consumed_at: 'consumedAt',
}

export const sqliteHarness: RepositoryHarness = {
  name: 'on SQLite',
  create: async (companyIds) => {
    const driver = createNodeDriver(':memory:')
    await migrate(driver)

    await driver.transaction(async (tx) => {
      for (const id of companyIds) {
        await tx.run(
          `insert into companies (id, name, locale_region, locale_language, currency)
           values (?, ?, 'NG', 'en', 'NGN')`,
          [id, id],
        )
      }
    })

    let counter = 0
    const repositories = createSqliteRepositories(driver, {
      newId: (prefix) => `${prefix}_${(++counter).toString(36)}`,
      now: () => '2026-09-14T00:00:00.000Z',
    })

    return {
      repositories,
      count: async (table) => {
        const row = await driver.get(`select count(*) as n from ${TABLE_OF[table]}`)
        return Number(row?.['n'] ?? 0)
      },
      linkTokenFields: async () => {
        const row = await driver.get('select * from link_tokens limit 1')
        if (row === null) return []
        // A column holding NULL is a column the row does not carry — the same
        // reading the in-memory store gives, where an absent optional field
        // simply is not a key.
        return Object.entries(row)
          .filter(([, value]) => value !== null)
          .map(([column]) => LINK_TOKEN_FIELD_OF[column] ?? column)
          .sort()
      },
      dispose: () => driver.close(),
    }
  },
}
