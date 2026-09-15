/**
 * Confirming a sign-out (§P, §V).
 *
 * The behaviours here are the ones a confirmation is FOR — and they are the
 * ones an inline panel does not have, which is why this sheet is modal when
 * the rest of the app's are not. A confirmation you can tab past, or one
 * where Return lands on the destructive button, has the shape of a
 * confirmation and none of the protection.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CompanyProvider } from '../../app/context'
import { createMemoryRepositories, emptyState } from '../../data/repositories'
import { SignOutSheet } from './SignOutSheet'

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

const open = () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  wrap(<SignOutSheet onConfirm={onConfirm} onCancel={onCancel} />)
  return { onConfirm, onCancel, user: userEvent.setup() }
}

describe('The sign-out confirmation', () => {
  it('is a modal dialog, named by its own question', async () => {
    open()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Sign out of DocFlow?')
  })

  /**
   * The destructive button is never what a stray Return lands on. §V's rule
   * about not relying on care: the safe answer is the default one.
   */
  it('opens with focus on staying, not on leaving', async () => {
    open()
    expect(await screen.findByRole('button', { name: 'Stay signed in' })).toHaveFocus()
  })

  it('signs out when that is what was asked for', async () => {
    const { onConfirm, user } = open()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('cancels on Escape, because the safe answer must be the cheap one', async () => {
    const { onCancel, user } = open()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('cancels on a tap outside, which means the same thing', async () => {
    const { onCancel, user } = open()
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  /** A tap on the sheet is not a tap on the backdrop behind it. */
  it('does not cancel when the sheet itself is tapped', async () => {
    const { onCancel, user } = open()
    await user.click(screen.getByText('Sign out of DocFlow?'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  /**
   * `aria-modal` hides the page behind from assistive tech; it does NOT take
   * it out of the tab order. Without the cycle, Tab walks out of the
   * confirmation and into a page the reader has been told is not there.
   */
  it('keeps Tab inside the two answers', async () => {
    const { user } = open()
    const stay = screen.getByRole('button', { name: 'Stay signed in' })
    const out = screen.getByRole('button', { name: 'Sign out' })

    expect(stay).toHaveFocus()
    await user.tab()
    expect(out).toHaveFocus()
    await user.tab({ shift: true })
    expect(stay).toHaveFocus()
  })

  /**
   * §P and Rule #6 together: signing out is about the ACCOUNT, and records
   * are on the device with export free forever. Copy that implied otherwise
   * would frighten somebody out of a safe action.
   */
  it('says the documents stay on the phone', async () => {
    open()
    expect(await screen.findByText(/documents stay on this phone/i)).toBeInTheDocument()
  })
})
