/**
 * The only data entry point the UI may import from (§C, CLAUDE.md).
 */

export * from './types'
export { createMemoryRepositories, emptyState, type MemoryState } from './memory/store'
