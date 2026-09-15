/**
 * How the money arrived, in words (§J, §S).
 */

import { describe, expect, it } from 'vitest'

import { stringsFor } from '../../domain/locale/data/strings'
import { availableMethods, methodName } from './methods'

const EN = stringsFor('en')

describe('A stored token is never what the owner reads (§E, §S)', () => {
  it('names the method in the active language', () => {
    expect(methodName(EN, 'bank_transfer')).toBe('Bank transfer')
  })

  it('never leaks the token itself for a method it knows', () => {
    expect(methodName(EN, 'bank_transfer')).not.toContain('_')
  })

  it('shows an unknown token rather than losing the evidence (§V)', () => {
    // A payment recorded by a provider this build has no word for is still
    // money. Hiding the method would lose part of the record.
    expect(methodName(EN, 'ussd_push')).toBe('ussd_push')
  })
})

describe('The picker never empties (Rule #1)', () => {
  it('offers what the owner switched on', () => {
    expect(availableMethods(['bank_transfer'], EN)).toEqual([
      { id: 'bank_transfer', name: 'Bank transfer' },
    ])
  })

  it('still offers a way to record money when everything is off', () => {
    // Money already in the till cannot be blocked by a settings screen.
    expect(availableMethods([], EN).map((m) => m.id)).toEqual([
      'bank_transfer',
      'cash_on_delivery',
    ])
  })

  it('ignores a method this build does not support', () => {
    expect(availableMethods(['card', 'wallet'], EN).map((m) => m.id)).toEqual([
      'bank_transfer',
      'cash_on_delivery',
    ])
  })
})
