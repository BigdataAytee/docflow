/**
 * The number a document is offered, for every type and after a conversion
 * (§G, §M).
 *
 * §M puts a unique (company, type, issued_reference) on the table, so a
 * collision is refused by the database — correctly, and at the worst possible
 * moment, with a customer waiting. Every issue path used to work the sequence
 * out as "how many of this type exist, plus one", which is the next free
 * number only while nothing has ever been removed. Void one of five and the
 * sixth document is offered the fifth's number.
 *
 * These drive the REAL screens rather than the helper, because the helper
 * being right was never the question: there were four call sites in the
 * builder and a fifth for credit notes, and any one of them could have kept
 * counting. What a person sees on the number card, and what the record ends
 * up carrying, is the thing being asserted.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from './App'
import { money } from '../domain/money/money'
import { devState, DEV_COMPANY_ID } from './seed'
import { createMemoryRepositories } from '../data/repositories'
import type { MemoryState } from '../data/repositories'
import type { DocumentType } from '../domain/documents/types'

/** An account a customer could actually pay into, so §J's gate opens. */
const PAID_BY_TRANSFER = {
  enabledPaymentMethods: ['bank_transfer'],
  bankFields: {
    bank_name: 'Guaranty Trust Bank',
    account_number: '0123456789',
    account_name: 'Sola Ventures',
  },
}

const PREFIXES = { invoice: 'INV', quotation: 'QUO', receipt: 'REC', waybill: 'WAY' }

const seeded = (over?: (state: MemoryState) => void) => {
  const state = devState()
  const company = state.companies[0]
  if (company !== undefined) {
    state.companies[0] = {
      ...company,
      name: 'Sola Ventures',
      ...PAID_BY_TRANSFER,
      numberingPrefixes: PREFIXES,
    }
  }
  over?.(state)
  return { state, repositories: createMemoryRepositories(state) }
}

const renderAt = (path: string, over?: (state: MemoryState) => void) => {
  const { state, repositories } = seeded(over)
  render(
    <App
      repositories={repositories}
      companyId={DEV_COMPANY_ID}
      router="memory"
      initialPath={path}
    />,
  )
  return state
}

const customer = (id = 'cus_1', name = 'Ade Stores') => ({
  id,
  companyId: DEV_COMPANY_ID,
  kind: 'company' as const,
  name,
  labels: [],
})

const line = (id: string, type: DocumentType) => ({
  id,
  description: 'Bag of cement',
  quantityMilli: 20_000,
  taxable: false,
  ...(type === 'waybill' ? { unit: 'bags' } : { unitPriceMinor: 5_000_00 }),
})

const issuedDocument = (type: DocumentType, index: number, reference: string) => ({
  id: `doc_${type}_${index}`,
  companyId: DEV_COMPANY_ID,
  type,
  status: 'issued',
  customerId: 'cus_1',
  currency: 'NGN',
  lineItems: [line(`li_${type}_${index}`, type)],
  issueDate: '2026-09-01',
  issuedReference: reference,
  frozenLabels: null,
  totalMinor: type === 'waybill' ? 0 : 100_000_00,
})

/**
 * A history with a HOLE in it, plus loud noise in the other three series.
 *
 * The hole is what separates "one past the highest" from "one past the
 * count". The noise is the second half of the question: four types, four
 * independent series, and a helper that forgot to filter by type would offer
 * a quotation a number taken from the invoices.
 */
const withGap =
  (type: DocumentType, references: readonly string[]) =>
  (state: MemoryState) => {
    state.customers.push(customer())
    references.forEach((reference, index) => {
      state.documents.push(issuedDocument(type, index, reference))
    })
    // The other series, numbered far higher, to be ignored entirely.
    let noise = 0
    for (const other of ['invoice', 'quotation', 'receipt', 'waybill'] as const) {
      if (other === type) continue
      noise += 1
      state.documents.push(issuedDocument(other, 90 + noise, `${PREFIXES[other]}-0087`))
    }
    // The draft under test, with no number of its own yet.
    state.documents.push({
      id: 'doc_draft',
      companyId: DEV_COMPANY_ID,
      type,
      status: 'draft',
      customerId: 'cus_1',
      currency: 'NGN',
      lineItems: [line('li_draft', type)],
      issueDate: '2026-09-20',
      issuedReference: null,
      frozenLabels: null,
      totalMinor: type === 'waybill' ? 0 : 100_000_00,
    })
  }

/** What the number card on step 1 actually reads. */
const numberShown = async (prefix: string): Promise<string> =>
  (await screen.findByText(new RegExp(`^${prefix}-\\d{4}`))).textContent ?? ''

describe('The number offered is one nothing already uses (§G, §M)', () => {
  /**
   * THE ONE THIS IS FOR, and it is every type because every type has its own
   * series and its own unique constraint. The count would offer a number the
   * fixture already issued.
   */
  it.each([
    ['invoice' as const, ['INV-0001', 'INV-0002', 'INV-0009'], 'INV-0010'],
    ['quotation' as const, ['QUO-0001', 'QUO-0007'], 'QUO-0008'],
    ['receipt' as const, ['REC-0001', 'REC-0006'], 'REC-0007'],
    ['waybill' as const, ['WAY-0004'], 'WAY-0005'],
  ])('offers a free number on a %s', async (type, existing, expected) => {
    renderAt('/edit/doc_draft', withGap(type, existing))

    expect(
      await numberShown(PREFIXES[type]),
      `the count would have offered a ${type} number already in use`,
    ).toContain(expected)
  })

  /**
   * AND THE NUMBER SHOWN IS THE NUMBER FROZEN. A suggestion that is not what
   * issuing produces is worse than no suggestion: it is a promise the
   * document breaks at the one moment anybody checks.
   */
  it('freezes the number it offered, all the way to issued', async () => {
    const user = userEvent.setup()
    const state = renderAt(
      '/edit/doc_draft',
      withGap('invoice', ['INV-0001', 'INV-0002', 'INV-0009']),
    )

    const offered = await numberShown('INV')
    expect(offered).toContain('INV-0010')

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }
    await user.click(await screen.findByRole('button', { name: /^Save/ }))

    const issued = () => state.documents.find((row) => row.id === 'doc_draft')
    await waitFor(() => expect(issued()?.status).toBe('issued'))
    expect(
      issued()?.issuedReference,
      'the number on the card was not the number the document got',
    ).toBe(offered.trim())
  })

  /**
   * AND THE PENCIL STILL WINS. The offered number is a suggestion, not a
   * rule — §G lets the owner type their own, and what they typed is what
   * gets frozen.
   */
  it('issues the number the owner typed over the top', async () => {
    const user = userEvent.setup()
    const state = renderAt(
      '/edit/doc_draft',
      withGap('invoice', ['INV-0001', 'INV-0002', 'INV-0009']),
    )

    await user.click(await screen.findByRole('button', { name: 'Edit reference' }))
    await user.type(await screen.findByRole('textbox', { name: 'Edit reference' }), 'dr-inv-0413{Enter}')
    // Typed in lower case, shown in capitals, because a reference read back
    // over a phone is the same number either way (§M).
    expect(await screen.findByText('DR-INV-0413')).toBeInTheDocument()

    for (let step = 0; step < 4; step += 1) {
      await user.click(await screen.findByRole('button', { name: 'Next' }))
    }
    await user.click(await screen.findByRole('button', { name: /^Save/ }))

    await waitFor(() =>
      expect(state.documents.find((row) => row.id === 'doc_draft')?.issuedReference).toBe(
        'DR-INV-0413',
      ),
    )
  })
})

describe('A converted document gets a number of its own (§G, §M)', () => {
  const quoteWithOwnNumber = (state: MemoryState) => {
    state.customers.push(customer())
    // The invoice series already has a hole in it.
    for (const [index, reference] of ['INV-0001', 'INV-0002', 'INV-0004'].entries()) {
      state.documents.push(issuedDocument('invoice', index, reference))
    }
    state.documents.push({
      ...issuedDocument('quotation', 0, 'DR-QUO-0413'),
      id: 'doc_quote',
      status: 'accepted',
      // What the owner typed on the quotation, which must not travel.
      referenceOverride: 'DR-QUO-0413',
    })
  }

  /**
   * THE ONE THIS IS FOR. Two documents, two types, two series: the invoice
   * made from a hand-numbered quotation must not arrive carrying the
   * quotation's number, and must not be offered an invoice number already
   * taken.
   */
  it('does not inherit the source’s number, and steps over the gap', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', quoteWithOwnNumber)

    await user.click(await screen.findByRole('button', { name: 'Convert to…' }))
    await user.click(screen.getByRole('button', { name: 'Turn into Invoice' }))

    await waitFor(() => {
      const made = state.documents.find((row) => row.type === 'invoice' && row.status === 'draft')
      expect(made, 'nothing was converted').toBeDefined()
      expect(
        made?.referenceOverride,
        'the invoice inherited the quotation’s hand-typed number',
      ).toBeUndefined()
    })

    const offered = await numberShown('INV')
    expect(offered, 'the count would have offered INV-0004, which exists').toContain('INV-0005')
    expect(offered).not.toContain('QUO')
  })

  /** And the quotation is left exactly as it was (§G, Rule #5). */
  it('leaves the original’s number untouched', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_quote', quoteWithOwnNumber)

    await user.click(await screen.findByRole('button', { name: 'Convert to…' }))
    await user.click(screen.getByRole('button', { name: 'Turn into Invoice' }))

    await waitFor(() =>
      expect(
        state.documents.some((row) => row.type === 'invoice' && row.status === 'draft'),
      ).toBe(true),
    )
    expect(state.documents.find((row) => row.id === 'doc_quote')?.issuedReference).toBe(
      'DR-QUO-0413',
    )
  })
})

describe('A credit note is numbered in its own series (§M)', () => {
  const NGN = (minor: number) => money('NGN', minor)

  const creditNote = (id: string, reference: string, invoiceId: string) => ({
    id,
    companyId: DEV_COMPANY_ID,
    invoiceId,
    amount: NGN(1_000_00),
    reference,
    reason: 'Short delivery',
    issuedAt: '2026-09-12T10:00:00Z',
    invoiceReference: 'INV-0087',
    invoiceTotal: NGN(100_000_00),
  })

  /** One invoice to credit, and a credit history with a hole in it. */
  const creditable = (state: MemoryState) => {
    state.customers.push(customer())
    state.documents.push({
      ...issuedDocument('invoice', 0, 'INV-0042'),
      id: 'doc_inv',
      frozenLabels: {
        printedTitle: 'INVOICE',
        partyLabel: 'Bill to',
        signatureCaption: 'Issued by',
        language: 'en',
      },
    })
    // Credited against an older invoice, so this one still has room.
    state.documents.push({ ...issuedDocument('invoice', 1, 'INV-0087'), id: 'doc_old' })
    for (const [index, reference] of ['CRN-0001', 'CRN-0002', 'CRN-0009'].entries()) {
      state.credits.push(creditNote(`crn_${index}`, reference, 'doc_old'))
    }
  }

  const issueACredit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Actions' }))
    await user.click(await screen.findByRole('button', { name: 'Credit some of this back' }))
    await user.type(screen.getByLabelText('How much?'), '1000')
    await user.type(screen.getByLabelText('Why?'), 'Short delivery')
    await user.click(screen.getByRole('button', { name: 'Credit it back' }))
  }

  /**
   * THE FIFTH CALL SITE. A credit note's reference is frozen at issue and
   * carries the same uniqueness as a document's, and this one counted: three
   * credits exist, so the fourth was offered CRN-0004, and a longer history collides outright.
   */
  it('offers one past the highest, not one past the count', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', creditable)
    await issueACredit(user)

    await waitFor(() => expect(state.credits).toHaveLength(4))
    const made = state.credits.find((note) => note.invoiceId === 'doc_inv')
    expect(
      made?.reference,
      'the count would have offered a reference a credit note already carries',
    ).toMatch(/^CRN-0010(-[A-Z0-9]{2})?$/)
  })

  /**
   * AND IN ITS OWN SERIES. This borrowed the company's INVOICE prefix, so an
   * owner who renamed their invoices to "SV" in Settings got credit notes
   * called SV-0010 as well — a credit note printing the very reference an
   * invoice carries, with no constraint anywhere that would notice.
   */
  it('does not borrow the prefix the owner chose for invoices', async () => {
    const user = userEvent.setup()
    const state = renderAt('/doc/doc_inv', (seed) => {
      creditable(seed)
      const company = seed.companies[0]
      if (company !== undefined) {
        seed.companies[0] = { ...company, numberingPrefixes: { ...PREFIXES, invoice: 'SV' } }
      }
    })
    await issueACredit(user)

    await waitFor(() => expect(state.credits).toHaveLength(4))
    const made = state.credits.find((note) => note.invoiceId === 'doc_inv')
    expect(
      made?.reference,
      'a credit note was numbered in the invoice series',
    ).not.toMatch(/^SV-/)
    expect(made?.reference).toMatch(/^CRN-0010(-[A-Z0-9]{2})?$/)
  })
})
