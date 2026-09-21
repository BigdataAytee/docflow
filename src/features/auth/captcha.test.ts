/**
 * Where a CAPTCHA belongs, and the three places it must never be (§R, §M).
 *
 * Supabase can require a CAPTCHA token on its auth endpoints. Switched on
 * carelessly that is a wall across the whole app, so these assert the two
 * moments it is allowed and, much more importantly, the ones it is not.
 *
 * The one that would break the product is the offline reopen. Rule #2:
 * "every core journey must pass in airplane mode", and §M's session model
 * exists so the app opens on Home with a stale session and no network. A
 * CAPTCHA is a network round trip by definition.
 *
 * THE TABLE LIVES HERE; the calls that read it are asserted beside the client
 * in `src/data/supabase/auth.test.ts`. §C forbids a feature importing a DB
 * client, and the lint rule caught this file doing exactly that — correctly.
 */

import { describe, expect, it } from 'vitest'

import { CAPTCHA_ALLOWED, captchaAllowedFor, captchaOptions } from './captcha'

describe('Only a deliberate sign-in or sign-up may be challenged (§R)', () => {
  /**
   * THE TWO THAT MAY. Somebody is at a form, they pressed a button, and they
   * are waiting for an answer they asked for — a slow widget is a cost they
   * can see the reason for.
   */
  it.each(['sign_in', 'sign_up'] as const)('allows a challenge on %s', (moment) => {
    expect(captchaAllowedFor(moment)).toBe(true)
  })

  /**
   * THE ONES THAT MAY NOT, named one at a time so adding a call without
   * deciding about it fails rather than defaults.
   *
   * · a refresh happens mid-invoice with no form on screen;
   * · restoring a session is how the app opens, offline, by design;
   * · a confirmation link already proved intent;
   * · Google runs its own challenge if it wants one;
   * · a reset link goes to an address they own;
   * · and leaving is never something to be challenged about.
   */
  it.each([
    'refresh_session',
    'restore_session',
    'complete_from_url',
    'sign_in_with_google',
    'password_reset',
    'sign_out',
  ])('refuses a challenge on %s', (operation) => {
    expect(captchaAllowedFor(operation), `${operation} would put up a wall`).toBe(false)
  })

  /** An operation nobody has decided about is refused, not allowed. */
  it('refuses anything it has never heard of', () => {
    expect(captchaAllowedFor('some_new_call')).toBe(false)
  })

  /**
   * AND THE TABLE COVERS EVERY CALL THE PORT MAKES. A guard over a table is
   * only worth what the table covers, so this fails the day a method is
   * added to `AuthService` without an entry here.
   */
  it('has decided about every auth call there is', () => {
    const decided = new Set(Object.keys(CAPTCHA_ALLOWED))
    for (const operation of [
      'sign_in',
      'sign_up',
      'refresh_session',
      'restore_session',
      'complete_from_url',
      'sign_in_with_google',
      'password_reset',
      'sign_out',
    ]) {
      expect(decided.has(operation), `${operation} has no entry`).toBe(true)
    }
  })
})

describe('Nothing changes until a token exists (§N)', () => {
  /**
   * THE SHIP-AHEAD PROPERTY. Switching CAPTCHA on is a dashboard setting;
   * until somebody does it there is no token, and the call must be byte for
   * byte what it was. Otherwise this lands as a behaviour change nobody
   * asked for.
   */
  it('sends nothing when there is no token', () => {
    expect(captchaOptions('sign_in', undefined)).toEqual({})
    expect(captchaOptions('sign_up', '')).toEqual({})
    expect(captchaOptions('sign_in', '   ')).toEqual({})
  })

  it('sends the token when there is one', () => {
    expect(captchaOptions('sign_up', 'tok_123')).toEqual({ captchaToken: 'tok_123' })
  })
})
