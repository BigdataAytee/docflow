/**
 * What the app says when auth refuses (§P, §S, Rule #4).
 *
 * The bug this file exists to keep fixed: `error.message` went straight to
 * the screen, so a rate-limited sign-in said "Email rate limit exceeded" — in
 * English, in a product with seven locales, at the one moment a person is
 * least able to guess what it means.
 */

import { describe, expect, it } from 'vitest'

import { stringsFor } from '../../domain/locale/data/strings'
import { classifyAuthFailure, refusalMessage, waitFrom } from './refusal'

const EN = stringsFor('en')
const say = (cause: unknown): string => refusalMessage(classifyAuthFailure(cause), EN)

describe('A refusal is classified by what is reliable, in that order (§P)', () => {
  it('takes 429 as the answer, whatever the prose says', () => {
    expect(classifyAuthFailure({ status: 429, message: 'anything at all' })).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: null,
    })
  })

  it('carries a wait through when the provider gives one', () => {
    expect(classifyAuthFailure({ status: 429, retryAfter: 90 })).toEqual({
      kind: 'rate_limited',
      retryAfterSeconds: 90,
    })
  })

  it('reads the provider code when there is no status', () => {
    expect(classifyAuthFailure({ code: 'over_request_rate_limit' }).kind).toBe('rate_limited')
    expect(classifyAuthFailure({ code: 'over_email_send_rate_limit' }).kind).toBe('rate_limited')
    expect(classifyAuthFailure({ code: 'invalid_credentials' }).kind).toBe('bad_credentials')
  })

  it('reads a request that never arrived as offline, not as a bad password', () => {
    expect(classifyAuthFailure(new TypeError('Failed to fetch')).kind).toBe('offline')
    expect(classifyAuthFailure({ message: 'NetworkError when attempting to fetch' }).kind).toBe(
      'offline',
    )
  })

  it('falls back to the message only when nothing better is there', () => {
    expect(classifyAuthFailure({ message: 'Email rate limit exceeded' }).kind).toBe('rate_limited')
    expect(classifyAuthFailure({ message: 'Invalid login credentials' }).kind).toBe(
      'bad_credentials',
    )
  })

  it('admits it does not know rather than guessing', () => {
    expect(classifyAuthFailure({ message: 'teapot' }).kind).toBe('unknown')
    expect(classifyAuthFailure(undefined).kind).toBe('unknown')
    expect(classifyAuthFailure('a string').kind).toBe('unknown')
  })
})

describe('The words are ours, and they are the same in both directions (§P, §S)', () => {
  it('never repeats the provider back to the person', () => {
    const provider = ['Email rate limit exceeded', 'Invalid login credentials', 'Failed to fetch']
    for (const message of provider) {
      const shown = say({ message })
      expect(shown).not.toContain(message)
      expect(Object.values(EN.account)).toContain(
        // Every branch resolves to a catalogue string, not a constructed one.
        shown.startsWith('Too many tries. Try again in') ? EN.account.tooManyTriesIn : shown,
      )
    }
  })

  it('says ONE thing for a wrong password and for no such account', () => {
    // Anything finer tells a stranger which addresses are registered.
    expect(say({ status: 400, code: 'invalid_credentials' })).toBe(EN.account.wrongDetails)
    expect(say({ message: 'Invalid login credentials' })).toBe(EN.account.wrongDetails)
    expect(EN.account.wrongDetails).not.toMatch(/no account|not found|unknown email/i)
  })

  it('tells somebody how long to wait when it knows, and does not invent one when it does not', () => {
    expect(say({ status: 429, retryAfter: 90 })).toBe('Too many tries. Try again in 2m.')
    expect(say({ status: 429 })).toBe(EN.account.tooManyTries)
    expect(EN.account.tooManyTries).not.toMatch(/\d/)
  })

  it('rounds a wait to something a person can act on', () => {
    expect(waitFrom(null)).toBeNull()
    expect(waitFrom(0)).toBeNull()
    expect(waitFrom(12)).toBe('12s')
    expect(waitFrom(61)).toBe('2m')
    expect(waitFrom(300)).toBe('5m')
  })

  it('sends an offline failure to the sentence that was already true', () => {
    expect(say(new TypeError('Failed to fetch'))).toBe(EN.account.needsConnection)
  })
})
