/**
 * Home and the per-type lists (§G).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import type { LocaleProfile } from '../../domain/locale/profile'
import { DocumentList, type ListRow } from '../documents/DocumentList'
import { Home } from './Home'

const NGN = (m: number) => money('NGN', m)

const wrap = (node: React.ReactNode, profile: LocaleProfile = { locale: 'EN-NG' }) => {
  const repositories = createMemoryRepositories(emptyState())
  return render(
    <CompanyProvider companyId="co_1" repositories={repositories} profile={profile} language="en">
      {node}
    </CompanyProvider>,
  )
}

const home = (over: Partial<React.ComponentProps<typeof Home>> = {}, profile?: LocaleProfile) => {
  const props: React.ComponentProps<typeof Home> = {
    businessName: 'Dynamic Renaissance Business Enterprises Ltd',
    userName: 'Sola',
    now: new Date('2026-09-11T09:00:00'),
    online: true,
    pendingCount: 0,
    failedCount: 0,
    outstanding: new Map([['NGN', NGN(95_000_00)]]),
    received: new Map([['NGN', NGN(50_000_00)]]),
    counts: { invoice: 4, quotation: 2, receipt: 1, waybill: 3 },
    attention: [],
    onOpenType: vi.fn(),
    onOpenDocument: vi.fn(),
    onSearch: vi.fn(),
    ...over,
  }
  wrap(<Home {...props} />, profile)
  return props
}

describe('Exactly two stat cards, currencies apart (§G, §V)', () => {
  it('shows outstanding and received this month', () => {
    home()
    expect(screen.getByLabelText('Outstanding')).toHaveTextContent('₦95,000.00')
    expect(screen.getByLabelText('Received this month')).toHaveTextContent('₦50,000.00')
  })

  it('lists each currency on its own line rather than summing (§G)', () => {
    home({
      outstanding: new Map([
        ['NGN', NGN(95_000_00)],
        ['USD', money('USD', 500_00)],
      ]),
    })
    const card = screen.getByLabelText('Outstanding')
    expect(card).toHaveTextContent('₦95,000.00')
    expect(card).toHaveTextContent('$500.00')
  })

  it('says nothing owed rather than showing a bare zero', () => {
    home({ outstanding: new Map(), received: new Map() })
    expect(screen.getByLabelText('Outstanding')).toHaveTextContent('Nothing owed')
  })
})

describe('The connectivity pill is truthful (§G, §M)', () => {
  it('says waiting when online with pending work', () => {
    home({ online: true, pendingCount: 3 })
    expect(screen.getByText('Waiting to upload')).toBeInTheDocument()
  })

  it('says saved on this phone when offline', () => {
    home({ online: false, pendingCount: 3 })
    expect(screen.getByText('Saved on this phone')).toBeInTheDocument()
  })
})

describe('Four type tiles, in the active terminology (Rule #5)', () => {
  it('names all four with their counts', () => {
    home()
    expect(screen.getByRole('button', { name: /Waybill/ })).toHaveTextContent('3')
    expect(screen.getByRole('button', { name: /Invoice/ })).toBeInTheDocument()
  })

  it('renames the delivery tile in EN-GB without changing anything else', () => {
    home({}, { locale: 'EN-GB' })
    expect(screen.getByRole('button', { name: /Delivery note/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Waybill/ })).not.toBeInTheDocument()
  })

  it('opens the type page when tapped', async () => {
    const user = userEvent.setup()
    const props = home()
    await user.click(screen.getByRole('button', { name: /Quotation/ }))
    expect(props.onOpenType).toHaveBeenCalledWith('quotation')
  })
})

describe('Needs attention (§G)', () => {
  it('offers Chase on an overdue invoice and Sign on a delivery', () => {
    home({
      attention: [
        { documentId: 'i1', kind: 'overdue', amount: NGN(95_000_00) },
        { documentId: 'w1', kind: 'in_transit' },
      ],
    })
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('Sign')).toBeInTheDocument()
    expect(screen.getByText('Overdue · ₦95,000.00')).toBeInTheDocument()
  })

  it('is absent entirely when nothing wants doing', () => {
    home({ attention: [] })
    expect(screen.queryByLabelText('Needs attention')).not.toBeInTheDocument()
  })
})

describe('Voice and Scan are absent until Phase 6 builds them (§N)', () => {
  it('shows no control that would do nothing if tapped', () => {
    home()
    // §N: an unavailable capability is stated plainly, never dressed up. A dead
    // control is worse than one that has not arrived.
    //
    // Anchored on purpose: /voice/i matches the Invoice tile, which is how
    // the first version of this test "passed" a claim it was not making.
    for (const name of [/^Voice$/i, /^Scan$/i, /^Record$/i, /^Dictate$/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })
})

describe('One page per type, never combined tabs (§G)', () => {
  const rows: ListRow[] = [
    { id: 'd1', reference: 'INV-0001', status: 'overdue', statusLabel: 'Overdue', customerName: 'Okoro & Sons', amount: NGN(145_000_00) },
  ]

  it('heroes the localised type name and count line', () => {
    wrap(<DocumentList type="invoice" rows={rows} onOpen={vi.fn()} onNew={vi.fn()} />)
    // The heading says the plural standing alone; the count line says it
    // inside a sentence, and the two are cased differently on purpose — the
    // catalogue carries both forms because case is part of the word and
    // which part depends on the language (§D).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Invoices')
    expect(screen.getByText('1 invoices')).toBeInTheDocument()
  })

  it('names the search after the type (§G)', () => {
    wrap(<DocumentList type="waybill" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />, { locale: 'EN-GB' })
    expect(screen.getByRole('searchbox', { name: /Search Delivery notes/ })).toBeInTheDocument()
  })

  it('shows no amount on a delivery document row (§G, §V)', () => {
    wrap(
      <DocumentList
        type="waybill"
        rows={[{ id: 'w1', reference: 'WAY-0001', status: 'in_transit', statusLabel: 'On its way', customerName: 'Okoro & Sons' }]}
        onOpen={vi.fn()}
        onNew={vi.fn()}
      />,
    )
    expect(screen.getByText('WAY-0001')).toBeInTheDocument()
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument()
  })

  it('shows the amount on a priced row', () => {
    wrap(<DocumentList type="invoice" rows={rows} onOpen={vi.fn()} onNew={vi.fn()} />)
    expect(screen.getByText('₦145,000.00')).toBeInTheDocument()
  })

  it('offers a skeleton before rows arrive and an empty state after', () => {
    const { unmount } = wrap(<DocumentList type="invoice" rows={null} onOpen={vi.fn()} onNew={vi.fn()} />)
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
    unmount()

    wrap(<DocumentList type="invoice" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />)
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })

  it('carries a FAB labelled with the type, not a bare plus (§F)', () => {
    wrap(<DocumentList type="quotation" rows={[]} onOpen={vi.fn()} onNew={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: '+ New quotation' }).length).toBeGreaterThanOrEqual(1)
  })
})
