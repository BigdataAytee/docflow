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

/**
 * A SIGNATURE THAT ARRIVES FROM SOMEWHERE ELSE (§M, §P).
 *
 * A customer signs a delivery on THEIR phone, through the public link. The
 * edge function writes the signature and kills the token atomically, so the
 * record is right the moment they lift their finger — but the owner's app was
 * not part of that conversation and had no reason to look again. Nothing
 * re-read unless the owner themselves changed something, so a signed delivery
 * went on reading "on its way" on the owner's screen.
 */
describe('The store re-reads when somebody looks at it again', () => {
  const Counter = () => {
    const data = useAppData()
    return <p>{`customers: ${data.customers.length}`}</p>
  }

  const mountCounter = (repositories: Repositories) =>
    render(
      <CompanyProvider
        companyId={COMPANY}
        repositories={repositories}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <AppDataProvider>
          <Counter />
        </AppDataProvider>
      </CompanyProvider>,
    )

  /**
   * THE ONE THIS EXISTS FOR. The record changes underneath — exactly what a
   * customer signing does — and the app finds out because it came back to the
   * front, not because the owner touched anything.
   */
  it('picks up a change made outside the app when it returns to the front', async () => {
    const state = emptyState()
    const repositories = createMemoryRepositories(state)
    mountCounter(repositories)
    await waitFor(() => expect(screen.getByText('customers: 0')).toBeInTheDocument())

    // Somebody else's write. No action is dispatched in this app at all.
    state.customers.push({
      id: 'cus_remote',
      companyId: COMPANY,
      kind: 'company',
      name: 'Signed elsewhere',
      labels: [],
    })

    globalThis.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(screen.getByText('customers: 1')).toBeInTheDocument())
  })

  /** Hidden means nobody is looking: re-reading then buys nothing. */
  it('does not re-read while the page is hidden', async () => {
    const state = emptyState()
    const repositories = createMemoryRepositories(state)
    const list = vi.spyOn(repositories.customers, 'list')
    mountCounter(repositories)
    await waitFor(() => expect(screen.getByText('customers: 0')).toBeInTheDocument())

    const before = list.mock.calls.length
    Object.defineProperty(globalThis.document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    globalThis.dispatchEvent(new Event('visibilitychange'))

    /*
     * WAIT BEFORE ASSERTING NOTHING HAPPENED.
     *
     * `load` is async, so a synchronous assertion here runs before the
     * microtask that would have called the repository — it passed with the
     * guard deleted, which is the whole thing it was meant to catch. Giving
     * the read a chance to happen is what makes its absence mean anything.
     */
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(list.mock.calls.length).toBe(before)
    Object.defineProperty(globalThis.document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })
})
