/**
 * Dark mode's choice, and what it resolves to (§G, §V).
 */

import { describe, expect, it } from 'vitest'

import {
  type ThemeChoice,
  applyScheme,
  isThemeChoice,
  schemeFor,
  storeChoice,
  storedChoice,
} from './theme'

const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    read: () => map,
  }
}

describe('System is the default, and it is not a third colour', () => {
  it('follows the phone when nothing was chosen', () => {
    expect(storedChoice(memory())).toBe('system')
    expect(schemeFor('system', true)).toBe('dark')
    expect(schemeFor('system', false)).toBe('light')
  })

  it('overrides the phone once somebody chooses', () => {
    // A choice is a choice: somebody who picks Light meant it, whatever the
    // phone says at sunset.
    expect(schemeFor('light', true)).toBe('light')
    expect(schemeFor('dark', false)).toBe('dark')
  })

  it('remembers a choice, and rejects a value that is not one', () => {
    const storage = memory()
    storeChoice('dark', storage)

    expect(storedChoice(storage)).toBe('dark')
    storage.read().set('docflow.theme', 'chartreuse')
    expect(storedChoice(storage), 'a junk value must not become a theme').toBe('system')
  })

  it('never throws when storage does', () => {
    // A private window, or blocked site data. A theme is not worth a crash,
    // and the phone is a perfectly good fallback.
    const hostile = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(storedChoice(hostile)).toBe('system')
    expect(() => storeChoice('dark', hostile)).not.toThrow()
  })

  it('accepts only the three choices', () => {
    for (const value of ['system', 'light', 'dark'] as ThemeChoice[]) {
      expect(isThemeChoice(value)).toBe(true)
    }
    for (const value of ['', 'DARK', 'auto', null, 7]) expect(isThemeChoice(value)).toBe(false)
  })
})

describe('The class goes on the document, and comes off again', () => {
  it('toggles `dark` rather than only adding it', () => {
    // The bug this prevents: switching back to light leaving `.dark` behind,
    // which is a theme you can enter and not leave.
    const classes = new Set<string>()
    const root = {
      classList: {
        toggle: (token: string, on?: boolean) => {
          if (on === true) classes.add(token)
          else classes.delete(token)
          return on === true
        },
      },
    } as unknown as { classList: DOMTokenList }

    applyScheme('dark', root)
    expect(classes.has('dark')).toBe(true)
    applyScheme('light', root)
    expect(classes.has('dark')).toBe(false)
  })
})
