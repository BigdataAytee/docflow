/**
 * Customer labels (§E, §Q Phase 2.5).
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import type { Customer } from '../../data/repositories'
import { CustomerList } from './CustomerList'
import {
  LabelError,
  MAX_LABEL_LENGTH,
  addLabel,
  cleanLabel,
  filterByLabels,
  hasLabel,
  labelsInUse,
  removeLabel,
} from './labels'

describe('Labels are the owner vocabulary, tidied (§E)', () => {
  it('keeps the spelling typed, trimmed and collapsed', () => {
    expect(cleanLabel('  Wholesale   buyer ')).toBe('Wholesale buyer')
  })

  it('refuses an empty label and an essay', () => {
    expect(() => cleanLabel('   ')).toThrow(LabelError)
    expect(() => cleanLabel('x'.repeat(MAX_LABEL_LENGTH + 1))).toThrow(LabelError)
  })

  it('treats case and spacing as the same label', () => {
    const labels = addLabel(addLabel([], 'Wholesale'), 'wholesale ')
    expect(labels).toEqual(['Wholesale'])
    expect(hasLabel(labels, 'WHOLESALE')).toBe(true)
  })

  it('removes without caring about case', () => {
    expect(removeLabel(['Wholesale', 'Church'], 'wholesale')).toEqual(['Church'])
  })

  it('lists the labels in use, commonest first', () => {
    const records = [
      { labels: ['Wholesale', 'Church'] },
      { labels: ['wholesale'] },
      { labels: [] },
    ]
    expect(labelsInUse(records)).toEqual(['Wholesale', 'Church'])
  })

  it('filters to records carrying every selected label', () => {
    const records = [
      { id: 'a', labels: ['Wholesale', 'Church'] },
      { id: 'b', labels: ['Wholesale'] },
    ]
    expect(filterByLabels(records, ['Wholesale']).map((r) => r.id)).toEqual(['a', 'b'])
    expect(filterByLabels(records, ['Wholesale', 'Church']).map((r) => r.id)).toEqual(['a'])
  })

  it('filters nothing when nothing is selected', () => {
    const records = [{ id: 'a', labels: [] }]
    expect(filterByLabels(records, [])).toHaveLength(1)
  })
})

describe('Labels on the customers screen (§G)', () => {
  const customers: Customer[] = [
    { id: 'cus_1', companyId: 'co_1', kind: 'company', name: 'Ade Stores', labels: ['Wholesale'] },
    { id: 'cus_2', companyId: 'co_1', kind: 'person', name: 'Bisi', labels: [] },
  ]

  async function renderList(rows: Customer[] = customers) {
    const repositories = createMemoryRepositories({ ...emptyState(), customers: rows })
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={repositories}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <CustomerList invoices={[]} payments={[]} />
      </CompanyProvider>,
    )
    await screen.findByText('Ade Stores')
  }

  it('shows a label on the card that has one', async () => {
    await renderList()
    // The word is on screen twice on purpose — as a filter chip and on the
    // card — so this looks inside the list rather than counting occurrences.
    const card = screen.getByText('Ade Stores').closest('button')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText('Wholesale')).toBeInTheDocument()
  })

  it('offers no label controls at all when nobody has a label (Rule #1)', async () => {
    await renderList([{ ...customers[0]!, labels: [] }])
    expect(screen.queryByRole('group', { name: 'Filter by label' })).not.toBeInTheDocument()
  })

  it('filters the list by a label, and back again', async () => {
    const user = userEvent.setup()
    await renderList()
    expect(screen.getByText('Bisi')).toBeInTheDocument()

    const group = screen.getByRole('group', { name: 'Filter by label' })
    await user.click(screen.getByRole('button', { name: 'Wholesale', pressed: false }))
    expect(screen.queryByText('Bisi')).not.toBeInTheDocument()
    expect(group).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show everyone' }))
    expect(screen.getByText('Bisi')).toBeInTheDocument()
  })

  it('says nobody has that label rather than showing a blank list', async () => {
    const user = userEvent.setup()
    await renderList([
      { ...customers[0]!, labels: ['Wholesale'] },
      { ...customers[1]!, labels: ['Church'] },
    ])
    await user.click(screen.getByRole('button', { name: 'Wholesale', pressed: false }))
    await user.click(screen.getByRole('button', { name: 'Church', pressed: false }))
    expect(screen.getByText('Nobody has that label yet.')).toBeInTheDocument()
  })

  it('finds a customer by a label typed into search', async () => {
    const user = userEvent.setup()
    await renderList()
    await user.type(screen.getByRole('searchbox'), 'wholesale')
    expect(screen.getByText('Ade Stores')).toBeInTheDocument()
    expect(screen.queryByText('Bisi')).not.toBeInTheDocument()
  })
})
