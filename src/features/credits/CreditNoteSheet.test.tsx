/**
 * The credit note sheet (Rule #5, §E).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { money } from '../../domain/money/money'
import { CreditNoteSheet } from './CreditNoteSheet'

const NGN = (m: number) => money('NGN', m)

function renderSheet(over: Partial<React.ComponentProps<typeof CreditNoteSheet>> = {}) {
  const props: React.ComponentProps<typeof CreditNoteSheet> = {
    invoiceId: 'doc_1',
    invoiceReference: 'INV-0042',
    invoiceTotal: NGN(145_000_00),
    existing: [],
    onIssue: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <CreditNoteSheet {...props} />
    </CompanyProvider>,
  )
  return props
}

describe('How much is still creditable', () => {
  it('names the invoice and what is left', () => {
    renderSheet()
    expect(screen.getByText('Against INV-0042')).toBeInTheDocument()
    expect(screen.getByText('₦145,000.00 of this can still be credited.')).toBeInTheDocument()
  })

  it('subtracts credits already issued', () => {
    renderSheet({ existing: [{ id: 'crn_1', invoiceId: 'doc_1', amount: NGN(45_000_00) }] })
    expect(screen.getByText('₦100,000.00 of this can still be credited.')).toBeInTheDocument()
  })

  it('says there is nothing left rather than offering a dead field', () => {
    renderSheet({ existing: [{ id: 'crn_1', invoiceId: 'doc_1', amount: NGN(145_000_00) }] })
    expect(screen.getByText('This one is fully credited already.')).toBeInTheDocument()
    expect(screen.queryByLabelText('How much?')).not.toBeInTheDocument()
  })

  it('fills the whole remaining amount in one tap', async () => {
    const user = userEvent.setup()
    renderSheet({ existing: [{ id: 'crn_1', invoiceId: 'doc_1', amount: NGN(45_000_00) }] })
    await user.click(screen.getByRole('button', { name: 'All of it' }))
    expect(screen.getByLabelText('How much?')).toHaveValue('100000')
  })
})

describe('What it will and will not send', () => {
  it('needs an amount and a reason', async () => {
    const user = userEvent.setup()
    renderSheet()
    const issue = screen.getByRole('button', { name: 'Credit it back' })
    expect(issue).toBeDisabled()

    await user.type(screen.getByLabelText('How much?'), '20000')
    expect(issue).toBeDisabled()

    await user.type(screen.getByLabelText('Why?'), 'Two bags short')
    expect(issue).toBeEnabled()
  })

  it('refuses more than is creditable, before anything is sent', async () => {
    const user = userEvent.setup()
    renderSheet()
    await user.type(screen.getByLabelText('How much?'), '200000')
    await user.type(screen.getByLabelText('Why?'), 'Too much')
    expect(screen.getByRole('button', { name: 'Credit it back' })).toBeDisabled()
  })

  it('sends minor units, in the invoice currency', async () => {
    const user = userEvent.setup()
    const props = renderSheet()
    await user.type(screen.getByLabelText('How much?'), '20000')
    await user.type(screen.getByLabelText('Why?'), 'Two bags short')
    await user.click(screen.getByRole('button', { name: 'Credit it back' }))

    expect(props.onIssue).toHaveBeenCalledWith({
      amount: NGN(20_000_00),
      reason: 'Two bags short',
    })
  })
})

describe('It says what a credit does not do (§V)', () => {
  it('states that income is untouched', () => {
    renderSheet()
    expect(
      screen.getByText(
        'A credit lowers what is owed. It never changes money you have already received.',
      ),
    ).toBeInTheDocument()
  })

  it('shows a failure where it happened', () => {
    renderSheet({ error: 'That could not be credited: nope' })
    expect(screen.getByRole('alert')).toHaveTextContent('nope')
  })
})
