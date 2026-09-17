/**
 * The sign-in screen, at the moment it is refused (§P, §S).
 *
 * `refusal.test.ts` proves the classification. This proves the screen is
 * wired to it — because the bug was never in a function, it was in the one
 * line that put the provider's English on the page.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SignInScreen } from './SignInScreen'
import { stringsFor } from '../../domain/locale/data/strings'

const EN = stringsFor('en')

const signInWith = async (failure: unknown) => {
  // One test signs in twice, to show the two shapes land on one sentence.
  cleanup()
  const user = userEvent.setup()
  render(
    <SignInScreen
      strings={EN}
      onSignIn={() => Promise.reject(failure)}
      onSignUp={() => Promise.resolve({ needsEmailConfirmation: false })}
    />,
  )
  await user.type(screen.getByLabelText(EN.account.email), 'owner@example.com')
  await user.type(screen.getByLabelText(EN.account.password), 'not-the-password')
  await user.click(screen.getByRole('button', { name: EN.account.signIn }))
  return await screen.findByRole('alert')
}

describe('A refused sign-in says something a person can act on', () => {
  it('says our sentence when the provider rate-limits, not its own', async () => {
    const alert = await signInWith({ status: 429, message: 'Email rate limit exceeded' })
    expect(alert).toHaveTextContent(EN.account.tooManyTries)
    expect(alert).not.toHaveTextContent(/rate limit exceeded/i)
  })

  it('names the wait when the provider gives one', async () => {
    const alert = await signInWith({ status: 429, retryAfter: 120 })
    expect(alert).toHaveTextContent('Try again in 2m.')
  })

  it('says the same thing for a wrong password and for no such account', async () => {
    // The wording may name the two fields — it has to, to be useful. What it
    // must never do is say WHICH was wrong, because that tells a stranger
    // which addresses are registered (§P).
    const wrongPassword = await signInWith({ status: 400, code: 'invalid_credentials' })
    expect(wrongPassword).toHaveTextContent(EN.account.wrongDetails)
    expect(wrongPassword).not.toHaveTextContent(/no account|not registered|user not found|wrong password/i)

    const noSuchAccount = await signInWith({ message: 'Invalid login credentials' })
    expect(noSuchAccount).toHaveTextContent(EN.account.wrongDetails)
  })

  it('does not dress a lost connection up as a rejected password', async () => {
    const alert = await signInWith(new TypeError('Failed to fetch'))
    expect(alert).toHaveTextContent(EN.account.needsConnection)
  })
})

/**
 * The sign-up that looked like nothing happening (§N, §S).
 *
 * Creating an account takes a round trip, and with confirmations on it ends
 * with NO session — so the screen stayed exactly as it was. Nothing said the
 * request was in flight and nothing said it had succeeded, which is
 * indistinguishable from a button that does not work.
 */
describe('Creating an account says what is happening', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: EN.account.noAccount }))
    await user.type(screen.getByLabelText(EN.account.email), 'new@example.com')
    await user.type(screen.getByLabelText(EN.account.password), 'a-long-enough-one')
  }

  it('says it is working while the request is in flight', async () => {
    cleanup()
    const user = userEvent.setup()
    let release: (value: { needsEmailConfirmation: boolean }) => void = () => {}
    render(
      <SignInScreen
        strings={EN}
        onSignIn={async () => {}}
        onSignUp={() => new Promise((resolve) => (release = resolve))}
      />,
    )
    await fill(user)
    await user.click(screen.getByRole('button', { name: EN.account.createAccount }))

    // Mid-flight: the button says so rather than just greying out.
    const working = await screen.findByRole('button', { name: EN.account.creatingAccount })
    expect(working).toHaveAttribute('aria-busy', 'true')

    release({ needsEmailConfirmation: false })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: EN.account.creatingAccount })).toBeNull(),
    )
  })

  /**
   * THE ONE THAT MATTERS. The account was created and cannot be used yet, and
   * the ONLY place that fact exists is the return value — the stage is still
   * `signed_out`, so nothing else on the screen changes at all.
   */
  it('tells them to check their email when confirmation is pending', async () => {
    cleanup()
    const user = userEvent.setup()
    render(
      <SignInScreen
        strings={EN}
        onSignIn={async () => {}}
        onSignUp={async () => ({ needsEmailConfirmation: true })}
      />,
    )
    await fill(user)
    await user.click(screen.getByRole('button', { name: EN.account.createAccount }))

    const notice = await screen.findByRole('status')
    expect(notice.textContent).toMatch(/confirmation link/i)
    // The address is named: a typo in it is the likeliest reason no mail
    // arrives, and it is the one thing the person can check themselves.
    expect(notice.textContent).toContain('new@example.com')
  })

  it('says nothing about email when the account is usable immediately', async () => {
    cleanup()
    const user = userEvent.setup()
    render(
      <SignInScreen
        strings={EN}
        onSignIn={async () => {}}
        onSignUp={async () => ({ needsEmailConfirmation: false })}
      />,
    )
    await fill(user)
    await user.click(screen.getByRole('button', { name: EN.account.createAccount }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: EN.account.creatingAccount })).toBeNull(),
    )
    expect(screen.queryByRole('status')).toBeNull()
  })
})
