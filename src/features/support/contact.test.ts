/**
 * The support number fails closed (§N).
 *
 * Every one of these is a value that would otherwise render a card an owner
 * taps while they have a problem, and which goes nowhere.
 */

import { describe, expect, it } from 'vitest'

import { normaliseSupportNumber, whatsAppLink } from './contact'

describe('A support number is a number or it is nothing', () => {
  it('takes a real one, in whatever punctuation it was written', () => {
    expect(normaliseSupportNumber('+234 801 234 5678')).toBe('2348012345678')
    expect(normaliseSupportNumber('234-801-234-5678')).toBe('2348012345678')
  })

  it.each([undefined, null, 42, '', '   ', 'TODO', 'set-me', '+', '12345'])(
    'refuses %p rather than half-rendering a card',
    (value) => {
      expect(normaliseSupportNumber(value)).toBeUndefined()
    },
  )

  it('builds the link one way, in one place', () => {
    expect(whatsAppLink('2348012345678')).toBe('https://wa.me/2348012345678')
  })
})
