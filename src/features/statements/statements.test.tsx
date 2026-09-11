/**
 * Customer statements (§L5, §Q Phase 2.5).
 *
 * The statement is a view. The tests that matter are the ones proving it
 * cannot become a record: printing it twice changes nothing, and a receipt
 * appearing on it would double a settled sale.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { type Payment, reversalOf } from '../../domain/payments/ledger'
import { type StatementDocument, composeStatement, statementCurrencies } from './compose'
import { StatementPage } from './StatementPage'

const NGN = (m: number) => money('NGN', m)
const USD = (m: number) => money('USD', m)

const PERIOD = { from: '2026-09-01', to: '2026-10-01' }

const invoice = (
  id: string,
  minor: number,
  issueDate: string,
  over: Partial<StatementDocument> = {},
): StatementDocument => ({
  id,
  type: 'invoice',
  status: 'issued',
  customerId: 'cus_1',
  total: NGN(minor),
  issueDate,
  issuedReference: `INV-${id}`,
  ...over,
})

const payment = (over: Partial<Payment> & Pick<Payment, 'id' | 'amount'>): Payment => ({
  customerId: 'cus_1',
  paidAt: '2026-09-10T10:00:00Z',
  method: 'bank_transfer',
  source: 'manual',
  allocations: [],
  ...over,
})

const compose = (over: Partial<Parameters<typeof composeStatement>[0]> = {}) =>
  composeStatement({
    customerId: 'cus_1',
    currency: 'NGN',
    ...PERIOD,
    documents: [],
    payments: [],
    ...over,
  })

describe('Invoices against payments, with a closing balance (§L5)', () => {
  it('runs a balance down the page', () => {
    const statement = compose({
      documents: [invoice('a', 100_000_00, '2026-09-02'), invoice('b', 50_000_00, '2026-09-20')],
      payments: [payment({ id: 'pay_1', amount: NGN(60_000_00), paidAt: '2026-09-10T09:00:00Z' })],
    })

    expect(statement.rows.map((row) => row.balance.minor)).toEqual([
      100_000_00,
      40_000_00,
      90_000_00,
    ])
    expect(statement.charged).toEqual(NGN(150_000_00))
    expect(statement.paid).toEqual(NGN(60_000_00))
    expect(statement.closingBalance).toEqual(NGN(90_000_00))
  })

  it('brings forward what was already owed before the period', () => {
    const statement = compose({
      documents: [invoice('old', 30_000_00, '2026-07-04'), invoice('a', 10_000_00, '2026-09-02')],
      payments: [],
    })
    expect(statement.openingBalance).toEqual(NGN(30_000_00))
    expect(statement.rows).toHaveLength(1)
    expect(statement.closingBalance).toEqual(NGN(40_000_00))
  })

  it('bills before it settles on the same day', () => {
    const statement = compose({
      documents: [invoice('a', 10_000_00, '2026-09-02')],
      payments: [payment({ id: 'pay_1', amount: NGN(10_000_00), paidAt: '2026-09-02T08:00:00Z' })],
    })
    expect(statement.rows.map((row) => row.kind)).toEqual(['charge', 'payment'])
    expect(statement.closingBalance).toEqual(NGN(0))
  })

  it('never mixes currencies onto one statement (§G)', () => {
    const statement = compose({
      documents: [
        invoice('a', 10_000_00, '2026-09-02'),
        invoice('b', 500_00, '2026-09-03', { total: USD(500_00) }),
      ],
      payments: [payment({ id: 'pay_1', amount: USD(100_00) })],
    })
    expect(statement.rows).toHaveLength(1)
    expect(statement.closingBalance).toEqual(NGN(10_000_00))
  })

  it('offers a statement per currency the customer has history in', () => {
    const currencies = statementCurrencies(
      'cus_1',
      [invoice('a', 10_000_00, '2026-09-02'), invoice('b', 500_00, '2026-09-03', { total: USD(500_00) })],
      [],
    )
    expect(currencies).toEqual(['NGN', 'USD'])
  })

  it('leaves out drafts, voids, quotations, delivery documents and receipts', () => {
    const statement = compose({
      documents: [
        invoice('draft', 99_00, '2026-09-02', { status: 'draft', issuedReference: null }),
        invoice('void', 99_00, '2026-09-02', { status: 'void' }),
        invoice('quote', 99_00, '2026-09-02', { type: 'quotation' }),
        invoice('waybill', 99_00, '2026-09-02', { type: 'waybill' }),
        invoice('receipt', 99_00, '2026-09-02', { type: 'receipt' }),
      ],
    })
    expect(statement.rows).toEqual([])
    expect(statement.closingBalance).toEqual(NGN(0))
  })

  it('a receipt for a payment cannot double that payment on the statement', () => {
    // The receipt document exists AND the payment exists. Only the payment
    // moves the balance — §V: issuing or resharing a receipt never increments
    // income, and the same rule decides what a statement may show.
    const statement = compose({
      documents: [invoice('a', 10_000_00, '2026-09-02'), invoice('rct', 10_000_00, '2026-09-10', { type: 'receipt' })],
      payments: [payment({ id: 'pay_1', amount: NGN(10_000_00) })],
    })
    expect(statement.rows.filter((row) => row.kind === 'payment')).toHaveLength(1)
    expect(statement.closingBalance).toEqual(NGN(0))
  })

  it('drops a reversed payment', () => {
    const original = payment({ id: 'pay_1', amount: NGN(10_000_00) })
    const statement = compose({
      documents: [invoice('a', 10_000_00, '2026-09-02')],
      payments: [original, reversalOf(original, 'pay_2', '2026-09-11T09:00:00Z')],
    })
    expect(statement.rows.map((row) => row.kind)).toEqual(['charge'])
    expect(statement.closingBalance).toEqual(NGN(10_000_00))
  })

  it('shows a credit note as a reduction, dated', () => {
    const statement = compose({
      documents: [invoice('a', 10_000_00, '2026-09-02')],
      creditNotes: [{ id: 'cn_1', invoiceId: 'a', amount: NGN(2_000_00) }],
      creditNoteDates: new Map([['cn_1', '2026-09-06']]),
      creditNoteReferences: new Map([['cn_1', 'CRN-0001']]),
    })
    expect(statement.credited).toEqual(NGN(2_000_00))
    expect(statement.closingBalance).toEqual(NGN(8_000_00))
  })

  it('never guesses a credit note onto a customer it cannot place', () => {
    const statement = compose({
      documents: [invoice('a', 10_000_00, '2026-09-02')],
      creditNotes: [{ id: 'cn_1', invoiceId: 'someone_elses_invoice', amount: NGN(2_000_00) }],
      creditNoteDates: new Map([['cn_1', '2026-09-06']]),
    })
    expect(statement.credited).toEqual(NGN(0))
  })

  it('is the same statement however many times it is composed', () => {
    const input = {
      documents: [invoice('a', 10_000_00, '2026-09-02')],
      payments: [payment({ id: 'pay_1', amount: NGN(4_000_00) })],
    }
    expect(compose(input)).toEqual(compose(input))
  })
})

describe('The printed statement (§L5)', () => {
  const statement = compose({
    documents: [invoice('a', 100_000_00, '2026-09-02')],
    payments: [payment({ id: 'pay_1', amount: NGN(60_000_00), reference: 'TRF-991' })],
  })

  function renderPage(value = statement) {
    render(
      <CompanyProvider
        companyId="co_1"
        repositories={createMemoryRepositories(emptyState())}
        profile={{ locale: 'EN-NG' }}
        language="en"
      >
        <StatementPage statement={value} businessName="Sola Ventures" customerName="Ade Stores" />
      </CompanyProvider>,
    )
  }

  it('prints the balance brought forward and carried forward', () => {
    renderPage()
    expect(screen.getByText('Balance brought forward')).toBeInTheDocument()
    expect(screen.getByText('Balance carried forward')).toBeInTheDocument()
    expect(screen.getByLabelText('Statement')).toHaveTextContent('₦40,000.00')
  })

  it('says which currency it is in, rather than leaving it to be assumed', () => {
    renderPage()
    expect(screen.getByText('All amounts in NGN.')).toBeInTheDocument()
  })

  it('shows an empty state rather than a blank sheet', () => {
    renderPage(compose())
    expect(screen.getByText('Nothing in this period')).toBeInTheDocument()
  })
})
