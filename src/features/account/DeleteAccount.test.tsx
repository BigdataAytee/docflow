/**
 * The way out, on screen (§S, §V, Rule #6; Apple 5.1.1(v)).
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { DeleteAccount } from './DeleteAccount'
import { AccountNotice } from '../../app/AccountNotice'
import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { GRACE_DAYS, type Lifecycle, requestDeletion } from '../../domain/account/deletion'
import { stringsFor } from '../../domain/locale/data/strings'

const strings = stringsFor('en')
const NAME = 'Dynamic Renaissance Ltd'
const NOW = new Date('2026-09-14T09:00:00.000Z')

const scheduled = (): Lifecycle => {
  const asked = requestDeletion({
    lifecycle: { state: 'active' },
    companyId: 'co_1',
    companyName: NAME,
    requestedBy: 'user_1',
    role: 'owner',
    typedName: NAME,
    exported: true,
    now: NOW,
  })
  if (!asked.ok) throw new Error('expected a request')
  return { state: 'scheduled', request: asked.value }
}

function show(props: Partial<React.ComponentProps<typeof DeleteAccount>> = {}) {
  const onRequest = vi.fn()
  const onCancel = vi.fn()
  const onExport = vi.fn()
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      <DeleteAccount
        lifecycle={{ state: 'active' }}
        companyName={NAME}
        role="owner"
        now={NOW}
        exported={false}
        onExport={onExport}
        onRequest={onRequest}
        onCancel={onCancel}
        {...props}
      />
    </CompanyProvider>,
  )
  return { onRequest, onCancel, onExport, user: userEvent.setup() }
}

describe('Deleting the business', () => {
  it('will not arm until the business name is typed', async () => {
    const { user, onRequest } = show()
    const button = screen.getByRole('button', { name: /Delete in/ })

    // The destructive tap must never be the one that discovers the rule.
    expect(button).toBeDisabled()

    await user.type(screen.getByLabelText(strings.deleteAccount.typeName), 'delete')
    expect(button).toBeDisabled()

    await user.clear(screen.getByLabelText(strings.deleteAccount.typeName))
    await user.type(screen.getByLabelText(strings.deleteAccount.typeName), NAME)
    expect(button).toBeEnabled()

    await user.click(button)
    expect(onRequest).toHaveBeenCalledWith(NAME)
  })

  it('says the number of days it says, from the one constant', () => {
    show()
    expect(screen.getByRole('button', { name: `Delete in ${GRACE_DAYS} days` })).toBeInTheDocument()
  })

  it('offers the export without demanding it', async () => {
    const { user, onExport } = show()
    await user.click(screen.getByRole('button', { name: strings.deleteAccount.exportAction }))
    expect(onExport).toHaveBeenCalled()

    // Rule #6: free forever, not a toll on the way out. The delete button is
    // gated on the typed name and on nothing else.
    await user.type(screen.getByLabelText(strings.deleteAccount.typeName), NAME)
    expect(screen.getByRole('button', { name: /Delete in/ })).toBeEnabled()
  })

  it('tells anybody who is not the owner why, rather than hiding the screen', () => {
    show({ role: 'staff' })
    expect(screen.getByText(strings.deleteAccount.ownerOnly)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete in/ })).not.toBeInTheDocument()
  })
})

describe('While it is scheduled', () => {
  it('shows the date and the days left, and keeps the way back to one tap', async () => {
    const { user, onCancel } = show({ lifecycle: scheduled() })

    expect(screen.getByText(/2026-10-14/)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${GRACE_DAYS} days left`))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: strings.deleteAccount.keep }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('still offers the export, because the records are still theirs', () => {
    show({ lifecycle: scheduled() })
    expect(
      screen.getByRole('button', { name: strings.deleteAccount.exportAction }),
    ).toBeInTheDocument()
  })
})

describe('The notice that follows you around', () => {
  function notice(lifecycle: Lifecycle) {
    const state = emptyState()
    const repositories = createMemoryRepositories(state)
    if (lifecycle.state === 'scheduled') state.deletion = lifecycle.request
    render(
      <MemoryRouter>
        <CompanyProvider
          companyId="co_1"
          repositories={repositories}
          profile={{ locale: 'EN-NG' }}
          language="en"
        >
          <AccountNotice now={NOW} />
        </CompanyProvider>
      </MemoryRouter>,
    )
  }

  it('says nothing at all on a live account', async () => {
    notice({ state: 'active' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is on the screen for the whole window, with the way back on it', async () => {
    notice(scheduled())
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(strings.deleteAccount.scheduledTitle)
    expect(banner).toHaveTextContent(`${GRACE_DAYS} days left`)
    expect(screen.getByRole('button', { name: strings.deleteAccount.keep })).toBeInTheDocument()
  })
})
