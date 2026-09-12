/**
 * Home's search results body (§G, §D.3).
 *
 * "Typing replaces the body with results; no match gives a plain empty state
 * with suggestions."
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { LocaleProfile } from '../../domain/locale/profile'
import { SearchResults } from './SearchResults'
import type { IndexEntry } from './index'

const entry = (over: Partial<IndexEntry> & Pick<IndexEntry, 'id' | 'kind' | 'label'>): IndexEntry => ({
  terms: [over.label.toLocaleLowerCase()],
  ...over,
})

function renderResults(
  over: Partial<React.ComponentProps<typeof SearchResults>> = {},
  profile: LocaleProfile = { locale: 'EN-NG' },
) {
  const props: React.ComponentProps<typeof SearchResults> = {
    query: 'cement',
    results: [],
    onOpenDocument: vi.fn(),
    onOpenCustomer: vi.fn(),
    onOpenItem: vi.fn(),
    onSuggest: vi.fn(),
    onClear: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={profile}
      language="en"
    >
      <SearchResults {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('Results, grouped by what they are (§G)', () => {
  const results = [
    entry({ id: 'doc_1', kind: 'document', label: 'INV-0042' }),
    entry({ id: 'cus_1', kind: 'customer', label: 'Ade Stores' }),
    entry({ id: 'item_1', kind: 'item', label: 'Bag of cement' }),
  ]

  it('keeps the three kinds apart', () => {
    renderResults({ results })
    expect(within(screen.getByLabelText('Documents')).getByText('INV-0042')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Customers')).getByText('Ade Stores')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Things you sell')).getByText('Bag of cement'),
    ).toBeInTheDocument()
  })

  it('says how many it found', () => {
    renderResults({ results })
    expect(screen.getByText('3 found')).toBeInTheDocument()
  })

  it('hides a group with nothing in it', () => {
    renderResults({ results: [results[0]!] })
    expect(screen.queryByLabelText('Customers')).not.toBeInTheDocument()
  })

  it('opens each kind through its own handler', async () => {
    const user = userEvent.setup()
    const props = renderResults({ results })

    await user.click(screen.getByText('INV-0042'))
    expect(props.onOpenDocument).toHaveBeenCalledWith('doc_1')

    await user.click(screen.getByText('Ade Stores'))
    expect(props.onOpenCustomer).toHaveBeenCalledWith('cus_1')

    await user.click(screen.getByText('Bag of cement'))
    expect(props.onOpenItem).toHaveBeenCalledOnce()
  })

  it('shows the second line a caller supplies, and nothing when it does not', () => {
    renderResults({
      results,
      detailOf: (row) => (row.kind === 'document' ? 'Ade Stores · Late · ₦95,000.00' : undefined),
    })
    expect(screen.getByText('Ade Stores · Late · ₦95,000.00')).toBeInTheDocument()
  })

  it('says where an item lives, since there is no page for one', () => {
    renderResults({ results })
    expect(screen.getByText('In your saved list')).toBeInTheDocument()
  })

  it('offers a way out of the search', async () => {
    const user = userEvent.setup()
    const props = renderResults({ results })
    await user.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(props.onClear).toHaveBeenCalledOnce()
  })

  it('announces the results without stealing focus', () => {
    renderResults({ results })
    expect(screen.getByText('3 found').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })
})

describe('No match — a plain empty state with suggestions (§G)', () => {
  it('quotes what was typed rather than saying "no results"', () => {
    renderResults({ query: 'zzzz' })
    expect(screen.getByText('Nothing matched "zzzz"')).toBeInTheDocument()
    expect(screen.getByText(/Search by a name, a number, an amount/)).toBeInTheDocument()
  })

  it('suggests this region own words for the four types', () => {
    renderResults({ query: 'zzzz' })
    // EN-NG: a delivery document is a waybill. The chip is the word that
    // actually finds them here (§D.3), never a hardcoded one.
    expect(screen.getByRole('button', { name: 'Waybill' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invoice' })).toBeInTheDocument()
  })

  it('suggests the UK words in the UK', () => {
    renderResults({ query: 'zzzz' }, { locale: 'EN-GB' })
    expect(screen.getByRole('button', { name: 'Delivery note' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Waybill' })).not.toBeInTheDocument()
  })

  it('runs the suggestion rather than only filling the field', async () => {
    const user = userEvent.setup()
    const props = renderResults({ query: 'zzzz' })
    await user.click(screen.getByRole('button', { name: 'Waybill' }))
    expect(props.onSuggest).toHaveBeenCalledWith('Waybill')
  })
})
