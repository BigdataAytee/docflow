/**
 * The in-memory store, as the contract suite sees it (§Q Phase 4).
 *
 * Thin by design: the suite's questions — how many rows are really there, what
 * does a stored link-token row carry — are answered straight off the arrays,
 * exactly as they were when the suite reached into them itself. Nothing about
 * what is asserted changed; only who is being asked.
 */

import type { CountableTable, RepositoryHarness } from '../harness'
import { type MemoryState, createMemoryRepositories, emptyState } from './store'

const seed = (companyIds: readonly string[]): MemoryState => {
  const state = emptyState()
  for (const id of companyIds) {
    state.companies.push({
      id,
      name: id,
      localeRegion: 'NG',
      localeLanguage: 'en',
      labelOverrides: {},
      currency: 'NGN',
      numberingPrefixes: {},
      bankFields: {},
      enabledPaymentMethods: [],
    })
  }
  return state
}

export const memoryHarness: RepositoryHarness = {
  name: 'in memory',
  create: async (companyIds) => {
    const state = seed(companyIds)
    return {
      repositories: createMemoryRepositories(state),
      count: async (table: CountableTable) => state[table].length,
      linkTokenFields: async () => Object.keys(state.linkTokens[0] ?? {}).sort(),
      dispose: async () => {
        // Nothing to release: the state goes out of scope with the test.
      },
    }
  },
}
