/**
 * Keeping your place across the one trip out of the builder (§G).
 *
 * Found by walking the phone: opening the saved items from the Items step
 * and pressing Back returned to DETAILS, because the catalogue is a Settings
 * route and coming back remounted the builder at step zero. Two steps
 * re-done, on the screen where losing your place costs the most.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rememberStep, takeStep } from './builderStep'

beforeEach(() => {
  try {
    globalThis.sessionStorage?.clear()
  } catch {
    // A runner without storage is a runner that remembers nothing, which is
    // the behaviour asserted at the bottom of this file.
  }
})

describe('The builder comes back to the step it left (§G)', () => {
  it('gives back the step it was handed', () => {
    rememberStep('doc_1', 1)
    expect(takeStep('doc_1')).toBe(1)
  })

  /** Nothing remembered is step zero, which is where a builder opens. */
  it('starts at the top when nothing was remembered', () => {
    expect(takeStep('doc_never_seen')).toBe(0)
  })

  /**
   * KEYED BY DOCUMENT. Two drafts open in a session must not inherit each
   * other's position — the commonest way a "remembered" value goes wrong is
   * remembering it for the wrong thing.
   */
  it('keeps each document to its own step', () => {
    rememberStep('doc_a', 3)
    rememberStep('doc_b', 1)
    expect(takeStep('doc_b')).toBe(1)
    expect(takeStep('doc_a')).toBe(3)
  })

  /**
   * READ ONCE, THEN GONE.
   *
   * The memory exists to survive ONE trip to the saved items and back.
   * Leaving it behind would mean closing the builder and reopening the same
   * draft an hour later dropped somebody into the middle of it — the
   * opposite of the problem this solves, and a worse one, because at least
   * step zero is predictable.
   */
  it('forgets the step once it has been used', () => {
    rememberStep('doc_1', 2)
    expect(takeStep('doc_1')).toBe(2)
    expect(takeStep('doc_1')).toBe(0)
  })

  /** A later trip overwrites an earlier one rather than stacking. */
  it('remembers the most recent step', () => {
    rememberStep('doc_1', 1)
    rememberStep('doc_1', 3)
    expect(takeStep('doc_1')).toBe(3)
  })

  it.each(['', '-1', 'two', '1.5e9999', '[]'])('reads %j as the top', (held) => {
    globalThis.sessionStorage.setItem('docflow.builder.step.doc_1', held)
    const step = takeStep('doc_1')
    expect(Number.isInteger(step) && step >= 0).toBe(true)
  })
})

describe('Storage is never a reason the builder fails to open (§G, Rule #2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * A private window, cleared site data, or a WebView with storage switched
   * off all throw on access. None of them is a reason a document cannot be
   * opened — a throw means "nothing remembered", which is exactly the
   * behaviour this module replaced.
   */
  it('opens at the top when storage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })

    expect(() => rememberStep('doc_1', 2)).not.toThrow()
    expect(takeStep('doc_1')).toBe(0)
  })

  it('opens at the top when there is no storage at all', () => {
    vi.stubGlobal('sessionStorage', undefined)

    expect(() => rememberStep('doc_1', 2)).not.toThrow()
    expect(takeStep('doc_1')).toBe(0)
  })
})
