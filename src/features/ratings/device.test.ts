/**
 * The counters, on a device that may refuse to remember anything (§T).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { readPromptState, writePromptState } from './device'
import { NEVER_ASKED } from '../../domain/ratings/prompt'

const KEY = 'docflow.ratings'

function storage(store: Record<string, string>, broken = false) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => {
        if (broken) throw new Error('site data blocked')
        return store[key] ?? null
      },
      setItem: (key: string, value: string) => {
        if (broken) throw new Error('site data blocked')
        store[key] = value
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'localStorage')
  vi.restoreAllMocks()
})

describe('Remembering, or failing to', () => {
  it('round-trips what it wrote', () => {
    const store: Record<string, string> = {}
    storage(store)

    writePromptState({ shares: 4, asks: 1, lastAskedAt: '2026-09-14T09:00:00.000Z' })
    expect(readPromptState()).toEqual({ shares: 4, asks: 1, lastAskedAt: '2026-09-14T09:00:00.000Z' })
  })

  it('starts from never-asked when there is nothing stored', () => {
    storage({})
    expect(readPromptState()).toEqual(NEVER_ASKED)
  })

  it('never crashes a screen because storage is blocked', () => {
    // A private window, blocked site data, a test environment with none. The
    // failure mode has to be "never asks", not "breaks the page somebody was
    // using": a rating prompt is the least important thing in this app.
    storage({}, true)
    expect(readPromptState()).toEqual(NEVER_ASKED)
    expect(() => writePromptState({ shares: 1, asks: 0 })).not.toThrow()
  })

  it('reads the fields rather than trusting the object', () => {
    // Somebody else's key, or a shape from a version that no longer exists.
    storage({ [KEY]: '{"shares":"lots","asks":-3,"lastAskedAt":42,"extra":true}' })
    expect(readPromptState()).toEqual({ shares: 0, asks: 0 })

    storage({ [KEY]: 'not json at all' })
    expect(readPromptState()).toEqual(NEVER_ASKED)

    storage({ [KEY]: 'null' })
    expect(readPromptState()).toEqual(NEVER_ASKED)
  })
})
