/**
 * The confirmation link that opened a dev server (§R, §C).
 *
 * A new owner confirmed their email and landed on `localhost:3000` — nothing,
 * on a phone. Nothing in the app had ever said where to come back to, so
 * GoTrue used the project's Site URL, and that was whatever a developer had
 * running months earlier.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { AUTH_CALLBACK, NATIVE_REDIRECT, authRedirectTo, codeFromUrl, isAuthCallback } from './redirect'

describe('Where an emailed link comes back to', () => {
  /**
   * THE ONE THIS EXISTS FOR. In the shell the bundle is served from
   * `https://localhost`, which is real to the WebView and meaningless to an
   * email client — so returning the browser origin on a device is the same
   * dead end wearing a different hostname.
   */
  it('never sends a phone back to the WebView’s own origin', () => {
    const target = authRedirectTo(true, 'https://localhost')
    expect(target).not.toContain('localhost')
    expect(target).toBe(NATIVE_REDIRECT)
  })

  it('uses the real origin in a browser', () => {
    expect(authRedirectTo(false, 'https://app.example.com')).toBe('https://app.example.com')
  })

  it('never returns a dev server, on either shell', () => {
    for (const target of [authRedirectTo(true, 'http://localhost:3000'), NATIVE_REDIRECT]) {
      expect(target).not.toMatch(/localhost:\d+/)
    }
  })
})

describe('Reading the code off a returning link', () => {
  it('reads the PKCE code from the query', () => {
    expect(codeFromUrl(`${NATIVE_REDIRECT}?code=abc123`)).toBe('abc123')
  })

  /** A project on the older implicit flow must not silently stop confirming. */
  it('reads it from the fragment too', () => {
    expect(codeFromUrl(`${NATIVE_REDIRECT}#code=frag456`)).toBe('frag456')
  })

  it.each(['not a url', `${NATIVE_REDIRECT}`, `${NATIVE_REDIRECT}?error=denied`])(
    'reads nothing from %s rather than inventing a code',
    (url) => {
      expect(codeFromUrl(url)).toBeNull()
    },
  )

  it('recognises our own callback and nothing else', () => {
    expect(isAuthCallback(`${NATIVE_REDIRECT}?code=x`)).toBe(true)
    expect(isAuthCallback('https://example.com/auth-callback')).toBe(false)
    expect(isAuthCallback('com.other.app://auth-callback')).toBe(false)
  })

  /**
   * The scheme here and the one in the manifest are one fact written twice,
   * and Android is silent when they disagree: the link opens a browser, the
   * app never hears about it, and the person sees the same dead page as
   * before. So the manifest is read rather than trusted.
   */
  it('is the scheme the AndroidManifest actually registers', () => {
    expect(NATIVE_REDIRECT).toBe(`com.docflow.app://${AUTH_CALLBACK}`)

    const manifest = readFileSync(
      join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8',
    )
    expect(manifest).toContain('android:scheme="com.docflow.app"')
    expect(manifest).toContain(`android:host="${AUTH_CALLBACK}"`)
    // A VIEW/BROWSABLE filter, or Android will not route a link to it at all.
    expect(manifest).toContain('android.intent.category.BROWSABLE')
  })
})
