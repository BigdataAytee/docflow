/**
 * The banner tells the truth about where the records went (§R).
 *
 * §R requires that a local demo is never passed off as an account, and the
 * banner has always said so. What it also said was that everything would be
 * "cleared when you close the tab" — the browser's answer, printed on a phone
 * where the encrypted SQLite store keeps everything, four pixels above Home
 * saying "Saved on this phone". Both sentences were on screen at once and one
 * of them was wrong.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DemoBanner } from './DemoBanner'

describe('Saying it is a demo, without saying something false', () => {
  /** The part §R requires, and it is in BOTH sentences. */
  it('always says nothing is saved to an account', () => {
    for (const durable of [true, false]) {
      const view = render(<DemoBanner durable={durable} />)
      expect(screen.getByRole('status')).toHaveTextContent(/nothing is saved to an account/i)
      view.unmount()
    }
  })

  it('warns about losing records only where they are really lost', () => {
    render(<DemoBanner durable={false} />)
    expect(screen.getByRole('status')).toHaveTextContent(/cleared when you close the tab/i)
  })

  /**
   * The bug. A phone has no tab, and this store survives being closed — so
   * the warning must not appear, and what replaces it has to still say the
   * records reach no other device.
   */
  it('says nothing about tabs where the records are kept', () => {
    render(<DemoBanner durable />)
    const banner = screen.getByRole('status')
    expect(banner).not.toHaveTextContent(/tab/i)
    expect(banner).not.toHaveTextContent(/cleared/i)
    expect(banner).toHaveTextContent(/another device/i)
  })

  /** Defaulting to the warning: an unknown store is assumed to lose things. */
  it('assumes the cautious answer when nobody said', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/cleared when you close the tab/i)
  })
})
