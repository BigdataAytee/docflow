/**
 * Back never costs an owner their typing (§Q Phase 4, §G).
 *
 * The case that matters most is the third one: on Home, with nothing layered
 * and nowhere to go back to, the FIRST press must not exit. Capacitor's
 * default does exit, and an owner three fields into a builder who taps back
 * expecting to leave a sheet would lose the lot.
 */

import { describe, expect, it, vi } from 'vitest'

import { CONFIRM_WINDOW_MS, type BackHandlers, decideBack } from './back'

const handlers = (over: Partial<BackHandlers> = {}): BackHandlers => ({
  closeTopLayer: () => false,
  canGoBack: () => false,
  goBack: vi.fn(),
  warn: vi.fn(),
  exit: vi.fn(),
  ...over,
})

const EXIT = 'Press back again to leave DocFlow'

describe('When something is layered over the page', () => {
  it('closes the top layer and nothing else', () => {
    const closeTopLayer = vi.fn(() => true)
    const back = handlers({ closeTopLayer, canGoBack: () => true })
    const state = { lastPressAt: null }

    expect(decideBack(back, state, 1_000, EXIT).action).toBe('closed_layer')
    expect(closeTopLayer).toHaveBeenCalledOnce()
    expect(back.goBack).not.toHaveBeenCalled()
    expect(back.exit).not.toHaveBeenCalled()
  })

  it('forgets a pending exit intent', () => {
    // The owner was dismissing a sheet, not asking to leave. Counting that as
    // half of "press back twice" would exit on the next ordinary press.
    const back = handlers({ closeTopLayer: () => true })
    const state = { lastPressAt: 1_000 }

    decideBack(back, state, 1_100, EXIT)
    expect(state.lastPressAt).toBeNull()
  })
})

describe('When there is somewhere to go back to', () => {
  it('goes back rather than exiting', () => {
    const back = handlers({ canGoBack: () => true })
    const state = { lastPressAt: null }

    expect(decideBack(back, state, 1_000, EXIT).action).toBe('went_back')
    expect(back.goBack).toHaveBeenCalledOnce()
    expect(back.exit).not.toHaveBeenCalled()
  })
})

describe('On Home, with nowhere left to go', () => {
  it('warns instead of exiting on the first press', () => {
    const back = handlers()
    const state = { lastPressAt: null }

    expect(decideBack(back, state, 1_000, EXIT).action).toBe('warned')
    expect(back.warn).toHaveBeenCalledWith(EXIT)
    expect(back.exit).not.toHaveBeenCalled()
  })

  it('exits on a second press inside the window', () => {
    const back = handlers()
    const state = { lastPressAt: null }

    decideBack(back, state, 1_000, EXIT)
    expect(decideBack(back, state, 1_000 + CONFIRM_WINDOW_MS - 1, EXIT).action).toBe('exited')
    expect(back.exit).toHaveBeenCalledOnce()
  })

  it('warns again when the second press is too late', () => {
    const back = handlers()
    const state = { lastPressAt: null }

    decideBack(back, state, 1_000, EXIT)
    const late = decideBack(back, state, 1_000 + CONFIRM_WINDOW_MS + 1, EXIT)

    expect(late.action).toBe('warned')
    expect(back.exit).not.toHaveBeenCalled()
    // And the clock restarts, so the next press is a first press.
    expect(state.lastPressAt).toBe(1_000 + CONFIRM_WINDOW_MS + 1)
  })

  it('never exits on a single press, however many times that press happens far apart', () => {
    const back = handlers()
    const state = { lastPressAt: null }

    for (const at of [1_000, 10_000, 20_000, 30_000]) decideBack(back, state, at, EXIT)
    expect(back.exit).not.toHaveBeenCalled()
    expect(back.warn).toHaveBeenCalledTimes(4)
  })
})
