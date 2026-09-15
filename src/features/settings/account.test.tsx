/**
 * Your account, and Help & support (§P, §G).
 *
 * Both screens exist because the Settings index named a group — "You & your
 * data" — whose first entry the reference has and this build did not. The
 * account one matters most: SIGNING OUT was reachable from exactly one place,
 * Home's header, and an owner who goes looking for it goes to Settings.
 *
 * The assertions are about what is REAL. §N's rule runs through both: a
 * control that cannot do the thing it names must not be drawn, so the support
 * card is absent until a number is configured, and the password row does what
 * the provider actually supports rather than collecting three passwords into
 * a form.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { AccountSettings } from './AccountSettings'
import { HelpSettings } from './HelpSettings'

const wrap = (node: React.ReactNode) =>
  render(
    <CompanyProvider
      companyId="co_1"
      repositories={createMemoryRepositories(emptyState())}
      profile={{ locale: 'EN-NG' }}
      language="en"
    >
      {node}
    </CompanyProvider>,
  )

describe('Your account shows who is signed in (§P)', () => {
  it('names the address and its initial', () => {
    wrap(
      <AccountSettings
        email="ada@dynamicren.ng"
        onSignOut={vi.fn()}
        onChangePassword={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.getByText('ada@dynamicren.ng')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  /**
   * THE REASON THIS SCREEN EXISTS. Sign-out was on Home's header alone, which
   * §F asks for and which nobody looking for it thinks to check.
   */
  it('offers a way out, and asks before taking it', async () => {
    const onSignOut = vi.fn()
    wrap(
      <AccountSettings
        email="ada@dynamicren.ng"
        onSignOut={onSignOut}
        onChangePassword={vi.fn(async () => undefined)}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    // The panel raises the confirmation; it never signs anybody out itself.
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  /**
   * The demo backend has no session, so there is nothing to sign out OF and
   * no password to change. A control offering either would be a lie.
   */
  it('offers neither sign-out nor a password when there is no account', () => {
    wrap(<AccountSettings onSignOut={vi.fn()} onChangePassword={vi.fn(async () => undefined)} />)

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change password/i })).not.toBeInTheDocument()
    expect(screen.getByText('No account on this device')).toBeInTheDocument()
  })
})

describe('Changing a password is the reset the provider issues (§P, §N)', () => {
  it('sends it and says where it went', async () => {
    const onChangePassword = vi.fn(async () => undefined)
    wrap(
      <AccountSettings
        email="ada@dynamicren.ng"
        onSignOut={vi.fn()}
        onChangePassword={onChangePassword}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(onChangePassword).toHaveBeenCalledOnce()
    expect(await screen.findByRole('status')).toHaveTextContent(/reset link is on its way/i)
  })

  /** §N: needs a connection, and says so rather than queueing invisibly. */
  it('says a failure was a failure, and that nothing was sent', async () => {
    wrap(
      <AccountSettings
        email="ada@dynamicren.ng"
        onSignOut={vi.fn()}
        onChangePassword={vi.fn(async () => {
          throw new Error('offline')
        })}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/nothing was sent/i)
  })

  /** No old-password, new-password, confirm-password form. Ever. */
  it('collects no password of any kind', () => {
    const { container } = wrap(
      <AccountSettings
        email="ada@dynamicren.ng"
        onSignOut={vi.fn()}
        onChangePassword={vi.fn(async () => undefined)}
      />,
    )
    expect(container.querySelector('input[type="password"]')).toBeNull()
  })
})

describe('Help answers questions about this app (§G)', () => {
  it('opens an answer in place and closes it again', async () => {
    wrap(<HelpSettings />)

    const question = screen.getByRole('button', { name: /work without internet/i })
    expect(question).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/saves on this phone first/i)).toBeInTheDocument()

    await userEvent.click(question)
    expect(question).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows one answer at a time', async () => {
    wrap(<HelpSettings />)

    await userEvent.click(screen.getByRole('button', { name: /work without internet/i }))
    await userEvent.click(screen.getByRole('button', { name: /become overdue/i }))

    expect(screen.queryByText(/saves on this phone first/i)).not.toBeInTheDocument()
    expect(screen.getByText(/day after the due date/i)).toBeInTheDocument()
  })

  /**
   * §N, and the one that matters: an owner with a problem is the last person
   * who should be handed a link that goes nowhere. No number configured, no
   * card — never a plausible-looking number typed into the source.
   */
  it('shows no support card until a number is configured', () => {
    wrap(<HelpSettings />)
    expect(screen.queryByText('Chat with support')).not.toBeInTheDocument()
  })
})

describe('Getting started reopens the welcome (§R, walkthrough)', () => {
  /**
   * §R's welcome was reachable exactly once — on a first run, before anybody
   * knew what they were looking at. Somebody who tapped past it had no way
   * back to the explanation of what the four document types are, and that is
   * precisely the person who needs it.
   */
  it('offers the way back into it', async () => {
    const onGettingStarted = vi.fn()
    wrap(<HelpSettings onGettingStarted={onGettingStarted} />)

    await userEvent.click(screen.getByRole('button', { name: /getting started/i }))
    expect(onGettingStarted).toHaveBeenCalledOnce()
  })

  /** No route to send them down, no row promising one. */
  it('shows no row where there is nowhere to go', () => {
    wrap(<HelpSettings />)
    expect(screen.queryByText('Getting started')).not.toBeInTheDocument()
  })
})
