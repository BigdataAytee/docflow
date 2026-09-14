/**
 * The sign-in screen, at the moment it is refused (§P, §S).
 *
 * `refusal.test.ts` proves the classification. This proves the screen is
 * wired to it — because the bug was never in a function, it was in the one
 * line that put the provider's English on the page.
 */

import { cleanup, render, screen } from '@testing-library/react'
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
      onSignUp={() => Promise.resolve()}
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
