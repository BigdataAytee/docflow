/**
 * An optional feature's failure stays inside that feature (§C, §N, §L4).
 *
 * THE BUG. `repositories.recurrences.list(companyId)` was awaited on the main
 * load path, inside the same `try` as the company, the customers and the
 * documents. A backend without the `recurrences` table threw, the catch set
 * the app-wide `error`, and someone who had just created their business was
 * shown a failure screen instead of Home — blocked out of an app that was
 * working, by a Phase 2.5 feature they had not asked for.
 *
 * Repeat is optional. Its absence may cost the Repeat panel and nothing else.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppDataProvider, useAppData } from './store'
import { CompanyProvider } from './context'
import { createMemoryRepositories, emptyState } from '../data/repositories'
import type { Repositories } from '../data/repositories'

const COMPANY = 'co_1'

/** Real repositories, with the recurrences read replaced by a refusal. */
function withBrokenRecurrences(): Repositories {
  const repositories = createMemoryRepositories(emptyState())
  return {
    ...repositories,
    recurrences: {
      ...repositories.recurrences,
      list: vi.fn(async () => {
        // The message PostgREST actually returns for a table it cannot find.
        throw new Error("Could not find the table 'public.recurrences' in the schema cache")
      }),
    },
  }
}

function Probe() {
  const data = useAppData()
  if (data.loading) return <p>loading</p>
  return (
    <>
      <p>{data.error === null ? 'no error' : `error: ${data.error}`}</p>
      <p>{`repeats: ${data.recurrences === null ? 'unavailable' : String(data.recurrences.length)}`}</p>
    </>
  )
}

const mount = (repositories: Repositories) =>
  render(
    <CompanyProvider
      companyId={COMPANY}
      repositories={repositories}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <AppDataProvider>
        <Probe />
      </AppDataProvider>
    </CompanyProvider>,
  )

describe('A missing recurrences table does not take the app down', () => {
  it('loads with no error when the recurrences read refuses', async () => {
    mount(withBrokenRecurrences())
    await waitFor(() => expect(screen.getByText('no error')).toBeInTheDocument())
  })

  /**
   * `null`, not `[]`. Empty means "nothing repeats yet", which is the ordinary
   * state of a new account and would draw a live toggle over a feature that
   * cannot act. The panel needs to be able to tell the two apart.
   */
  it('reports the feature absent rather than reporting no repeats', async () => {
    mount(withBrokenRecurrences())
    await waitFor(() => expect(screen.getByText('repeats: unavailable')).toBeInTheDocument())
  })

  it('says zero repeats — not "unavailable" — when the feature works', async () => {
    mount(createMemoryRepositories(emptyState()))
    await waitFor(() => expect(screen.getByText('repeats: 0')).toBeInTheDocument())
  })

  /** Whatever else the load fetched is still there; only Repeat is missing. */
  it('still loads everything else', async () => {
    const repositories = withBrokenRecurrences()
    mount(repositories)
    await waitFor(() => expect(screen.getByText('no error')).toBeInTheDocument())
    expect(screen.queryByText('loading')).toBeNull()
  })
})
