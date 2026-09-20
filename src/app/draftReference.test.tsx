/**
 * One document, one number, on every screen that shows one (§G, §M).
 *
 * A draft has no issued reference, so each surface answered "what goes in the
 * number column" for itself — and they disagreed. The builder's card said
 * `INV-0005-0P`, the number the draft would actually be given. The list page,
 * the customer's history, the search index and the document's own preview all
 * said `INV-…`.
 *
 * Two answers for one document. Somebody moving between the list and the
 * builder saw different things and had to work out which was real, and the
 * ellipsis is not a number anybody can read back over a phone or type into a
 * search box.
 *
 * The fix is one helper read by all five, so the test is one fixture read by
 * all five: every surface is asked the same question and has to give the same
 * answer. A per-surface test would have passed happily on the split.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories } from '../data/repositories'
import type { MemoryState } from '../data/repositories'

const PREFIXES = { invoice: 'INV', quotation: 'QUO', receipt: 'REC', waybill: 'WAY' }

const seeded = (over?: (state: MemoryState) => void) => {
  const state = devState()
  const company = state.companies[0]
  if (company !== undefined) {
    state.companies[0] = { ...company, name: 'Sola Ventures', numberingPrefixes: PREFIXES }
  }
  over?.(state)
  return { state, repositories: createMemoryRepositories(state) }
}

const renderAt = (path: string, over?: (state: MemoryState) => void) => {
  const { state, repositories } = seeded(over)
  const view = render(
    <App
      repositories={repositories}
      companyId={DEV_COMPANY_ID}
      router="memory"
      initialPath={path}
    />,
  )
  return { state, view }
}

const line = {
  id: 'li_1',
  description: 'Bag of cement',
  quantityMilli: 20_000,
  unitPriceMinor: 5_000_00,
  taxable: false,
}

/**
 * Three invoices with a HOLE, one draft.
 *
 * The hole matters here for the same reason it matters everywhere else: it is
 * what separates the right answer from a count, so a surface that guessed
 * would guess wrong rather than accidentally right.
 */
const withDraft = (state: MemoryState) => {
  state.customers.push({
    id: 'cus_1',
    companyId: DEV_COMPANY_ID,
    kind: 'company' as const,
    name: 'Ade Stores',
    labels: [],
  })
  for (const [index, reference] of ['INV-0001', 'INV-0002', 'INV-0009'].entries()) {
    state.documents.push({
      id: `doc_issued_${index}`,
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [line],
      issueDate: '2026-09-01',
      issuedReference: reference,
      frozenLabels: null,
      totalMinor: 100_000_00,
    })
  }
  state.documents.push({
    id: 'doc_draft',
    companyId: DEV_COMPANY_ID,
    type: 'invoice',
    status: 'draft',
    customerId: 'cus_1',
    currency: 'NGN',
    lineItems: [line],
    issueDate: '2026-09-20',
    issuedReference: null,
    frozenLabels: null,
    totalMinor: 100_000_00,
  })
}

/** The offered number, whichever screen is on. */
const OFFERED = /^INV-0010(-[A-Z0-9]{2})?$/

const numberOn = async (): Promise<string> =>
  (await screen.findByText(/^INV-\d{4}/)).textContent?.trim() ?? ''

describe('A draft is called the same thing everywhere (§G, §M)', () => {
  /**
   * THE BUILDER, which was the only one telling the truth. Kept here so the
   * other four are compared against a stated value rather than against each
   * other — four surfaces agreeing on `INV-…` would otherwise pass.
   */
  it('offers the number on the builder’s card', async () => {
    renderAt('/edit/doc_draft', withDraft)
    expect(await numberOn()).toMatch(OFFERED)
  })

  /**
   * THE LIST PAGE, which said `INV-…`. This is the screen the user was
   * standing on when they asked: a person moving from here into the builder
   * saw the number change under them.
   */
  it('shows it on the list page, where the ellipsis used to be', async () => {
    renderAt('/list/invoice', withDraft)

    const row = await screen.findByText(OFFERED)
    expect(row).toBeInTheDocument()
    expect(screen.queryByText(/^INV-…$/), 'the ellipsis is still on the list').toBeNull()
  })

  /**
   * AND IT LOOKS LIKE A DRAFT. The point was never to put a real-looking
   * number in a column of real ones — an unmarked `INV-0010` beside three
   * issued invoices reads as a fourth issued invoice.
   */
  it('marks the draft’s number as an offer, and the issued ones as facts', async () => {
    renderAt('/list/invoice', withDraft)

    const offered = await screen.findByText(OFFERED)
    expect(
      offered.getAttribute('data-provisional'),
      'the offered number is not marked as one',
    ).toBe('true')
    expect(offered.className).toContain('opacity-55')

    const issued = screen.getByText('INV-0009')
    expect(
      issued.getAttribute('data-provisional'),
      'an issued reference was marked provisional',
    ).toBeNull()
    expect(issued.className).not.toContain('opacity-55')
  })

  /** THE CUSTOMER'S HISTORY, the third place the same document appears. */
  it('shows it in the customer’s history', async () => {
    renderAt('/customers/cus_1', withDraft)

    const offered = await screen.findByText(OFFERED)
    expect(offered.getAttribute('data-provisional')).toBe('true')
    expect(screen.queryByText(/^INV-…$/)).toBeNull()
  })

  /**
   * THE DOCUMENT'S OWN PREVIEW, which is the page you land on from the list
   * and the page the PDF is drawn from.
   */
  it('shows it on the document page', async () => {
    renderAt('/doc/doc_draft', withDraft)

    await screen.findByText(/still a draft/i)
    expect(await screen.findByText(OFFERED)).toBeInTheDocument()
    expect(screen.queryByText(/^INV-…$/)).toBeNull()
  })

  /**
   * AND SEARCH FINDS IT BY THAT NUMBER. `INV-…` was not something anybody
   * would ever type, so a draft was unfindable by its number — while the
   * list page showed that number as though it were one.
   */
  it('finds the draft by the number on screen', async () => {
    const user = userEvent.setup()
    renderAt('/', withDraft)

    const offered = 'INV-0010'
    await user.type(await screen.findByPlaceholderText(/Search/), offered)

    await waitFor(() => expect(screen.getAllByText(OFFERED).length).toBeGreaterThan(0))
  })

  /**
   * THE ONE THAT TIES THEM TOGETHER. Read the number off the list, then off
   * the builder, and require the two strings to be identical — which is the
   * property the person asking cared about, stated directly rather than
   * inferred from four separate matches.
   */
  it('gives the list and the builder the same string', async () => {
    const { view } = renderAt('/list/invoice', withDraft)
    const onTheList = (await screen.findByText(OFFERED)).textContent?.trim()
    view.unmount()

    renderAt('/edit/doc_draft', withDraft)
    const inTheBuilder = await numberOn()

    expect(inTheBuilder, 'the number changed between two screens').toBe(onTheList)
  })

  /**
   * AND THE OWNER'S OWN NUMBER TRAVELS TOO, still marked as an offer: typed
   * is not the same as issued, and the list should not present a hand-typed
   * draft number as a document that exists under it.
   */
  it('shows a typed number everywhere, still as an offer', async () => {
    renderAt('/list/invoice', (state) => {
      withDraft(state)
      const draft = state.documents.find((row) => row.id === 'doc_draft')
      if (draft !== undefined) {
        state.documents[state.documents.indexOf(draft)] = {
          ...draft,
          referenceOverride: 'DR-INV-0413',
        }
      }
    })

    const typed = await screen.findByText('DR-INV-0413')
    expect(typed.getAttribute('data-provisional')).toBe('true')
  })

  /** And an issued document is untouched by any of this (Rule #5). */
  it('leaves an issued reference exactly as it was frozen', async () => {
    renderAt('/list/invoice', withDraft)

    const issued = await screen.findByText('INV-0009')
    expect(within(issued.closest('li') ?? issued).queryByText(OFFERED)).toBeNull()
  })
})

/**
 * The receipt flow's own preview, which was the sixth surface (§M, §V).
 *
 * It is the one thing somebody looks at before pressing "Record payment" —
 * the goods, the invoice total, what is being paid, what is left — and it
 * printed `REC-…` at the top while the bill it settles, named two lines
 * above on the same screen, read `INV-0005-0P`. One page, two conventions.
 *
 * Found by walking the quotation's "They've paid" on the phone, after the
 * other five were already unified.
 */
describe('The receipt about to be issued knows its own number (§M, §V)', () => {
  const owed = (state: MemoryState) => {
    withDraft(state)
    // A bill with money outstanding, so the flow has something to settle.
    state.documents.push({
      id: 'doc_owed',
      companyId: DEV_COMPANY_ID,
      type: 'invoice',
      status: 'issued',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [line],
      issueDate: '2026-09-02',
      issuedReference: 'INV-0011',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Issued by',
        language: 'en',
      },
      totalMinor: 100_000_00,
    })
    // And two receipts already issued, so the offer is not simply REC-0001.
    for (const [index, reference] of ['REC-0001', 'REC-0006'].entries()) {
      state.documents.push({
        id: `doc_rec_${index}`,
        companyId: DEV_COMPANY_ID,
        type: 'receipt',
        status: 'issued',
        customerId: 'cus_1',
        currency: 'NGN',
        lineItems: [],
        issueDate: '2026-09-03',
        issuedReference: reference,
        frozenLabels: null,
        totalMinor: 1_000_00,
      })
    }
  }

  it('prints the number it will get, not an ellipsis', async () => {
    const user = userEvent.setup()
    renderAt('/new/receipt', owed)

    // §G's first question: somebody paying a bill they already owe.
    await user.click(await screen.findByRole('button', { name: /owe|bill/i }))
    await user.click(await screen.findByText('Ade Stores'))
    // The picker leads with the goods and carries the reference below them.
    await user.click(await screen.findByText(/INV-0011 ·/))

    // The bill names itself, and so does the receipt settling it.
    expect(await screen.findByText(/^REC-0007(-[A-Z0-9]{2})?$/)).toBeInTheDocument()
    expect(screen.queryByText(/^REC-…$/), 'the receipt still prints an ellipsis').toBeNull()
  })
})
