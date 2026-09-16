/**
 * The password rule, mirrored from the dashboard (§K, §S).
 */

import { describe, expect, it } from 'vitest'

import { PASSWORD_MIN_LENGTH, passwordProblem } from './password'

describe('The client copy of the server rule', () => {
  it('matches the minimum the project is set to', () => {
    // Supabase → Authentication → Policies, set to 8 on 2026-09-16. If that
    // changes, this number changes with it — and never upward on its own.
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('refuses one that is too short', () => {
    expect(passwordProblem('short')).toBe('too_short')
    expect(passwordProblem('1234567')).toBe('too_short')
  })

  it('accepts one that is long enough', () => {
    expect(passwordProblem('12345678')).toBeNull()
    expect(passwordProblem('a much longer passphrase')).toBeNull()
  })

  /**
   * Counted in code points. Eight emoji is eight characters to whoever typed
   * them; `.length` calls it sixteen, which would accept a password the
   * server then refuses — the client being LOOSER is harmless, but being
   * wrong in a way the person cannot see is not.
   */
  it('counts characters the way a person does', () => {
    expect('👩‍💻'.length).toBeGreaterThan(1)
    expect(passwordProblem('🔑🔑🔑🔑')).toBe('too_short')
    expect(passwordProblem('🔑🔑🔑🔑🔑🔑🔑🔑')).toBeNull()
  })
})
