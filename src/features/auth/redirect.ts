/**
 * Where an emailed auth link comes back to (§R, §C).
 *
 * The confirmation email opened `localhost:3000` — a dev server, on a phone,
 * which is nothing. That happened because nothing in the app ever said where
 * to return, so GoTrue fell back to the project's Site URL, and the Site URL
 * was whatever the first developer had running.
 *
 * Two different answers are needed, because there are two shells:
 *
 *  · **In the app**, the bundle is served from `https://localhost` inside the
 *    WebView. That origin is real to the WebView and meaningless to an email
 *    client, so returning to it is the same dead end in a different costume.
 *    The app registers a custom scheme and the link comes back through
 *    Android's intent system.
 *  · **On the web**, the origin the person is already on is correct.
 *
 * Every value this produces must also be in the project's redirect allow-list,
 * or GoTrue silently substitutes the Site URL and the dead link returns. The
 * exact values are in PLAN.md under "Supabase dashboard settings".
 */

/** Matches the `android:scheme` in `AndroidManifest.xml`. */
export const APP_SCHEME = 'com.docflow.app'

/** The single path every emailed link returns to, on both shells. */
export const AUTH_CALLBACK = 'auth-callback'

/** The deep link Android hands back to the app. */
export const NATIVE_REDIRECT = `${APP_SCHEME}://${AUTH_CALLBACK}`

/**
 * Where a confirmation, reset or OAuth round trip should land.
 *
 * `webOrigin` is only read off the browser; on a device it is ignored
 * precisely because `https://localhost` is what it would be.
 */
export function authRedirectTo(native: boolean, webOrigin: string): string {
  return native ? NATIVE_REDIRECT : webOrigin
}

/**
 * The auth code carried back on a returning link, if there is one.
 *
 * PKCE (`flowType: 'pkce'`) returns `?code=…`; the older implicit flow returns
 * tokens in the fragment. Both shapes are read so that a project switched
 * between them does not silently stop confirming anybody.
 */
export function codeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const query = parsed.searchParams.get('code')
    if (query !== null && query !== '') return query
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const hashed = fragment.get('code')
    return hashed === null || hashed === '' ? null : hashed
  } catch {
    return null
  }
}

/** Whether a URL Android handed us is one of ours to act on. */
export const isAuthCallback = (url: string): boolean =>
  url.startsWith(`${APP_SCHEME}://${AUTH_CALLBACK}`)
