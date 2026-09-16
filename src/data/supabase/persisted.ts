/**
 * The session as it sits in storage, and what a failure to refresh it means.
 *
 * WHY THIS EXISTS. The requirement is blunt: after the first sign-in the app
 * opens on Home, every time, forever. A person sees a sign-in screen only on a
 * new device, after signing out on purpose, or when the session has genuinely
 * been revoked — never after an update, never after weeks offline, and never
 * because a token refresh failed while the phone had no signal.
 *
 * `getSession()` cannot carry that guarantee on its own. It refreshes an
 * expired token internally and, depending on the library version and what the
 * network did, may answer with no session at all — which this app would read
 * as "signed out" and answer with a login screen. That is the exact failure
 * the requirement forbids, and it would arrive as a library upgrade rather
 * than as a change anybody made here.
 *
 * So the decision is made from two facts this app owns instead: whether a
 * session was ever persisted, and what the server said when asked to renew it.
 *
 *  · NO STORED SESSION — nobody has signed in on this device, or they signed
 *    out and it was cleared. A sign-in screen is correct.
 *  · STORED, AND THE SERVER REFUSED IT — revoked, deleted, or the password
 *    changed elsewhere. A sign-in screen is correct, and it is the only case
 *    where losing the session is the right answer.
 *  · STORED, AND THE SERVER COULD NOT BE REACHED — offline, aeroplane mode, a
 *    dead cell. STALE, not signed out: §M says a credential problem never
 *    costs somebody their work, and Rule #2 says offline is the product.
 *
 * The third case is the one this file is really for, and it is the one a
 * library is most likely to get wrong on our behalf.
 */

/** What a persisted Supabase session looks like, in the part we rely on. */
export interface StoredSession {
  readonly refresh_token?: unknown
  readonly access_token?: unknown
}

/** Reads the blob supabase-js persists. Injectable so the rule is testable. */
export type ReadStorage = (key: string) => string | null

export const browserStorage: ReadStorage = (key) => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    // A private window, disabled site data, a WebView with storage off. An
    // unguarded read here would stop the app starting at all.
    return null
  }
}

/**
 * The refresh token a previous sign-in left behind, if there is one.
 *
 * Anything unparseable counts as absent. A corrupt blob must not trap
 * somebody in an app that can never reach the server — that is the opposite
 * failure and just as bad.
 */
export function storedRefreshToken(read: ReadStorage, key: string): string | null {
  const raw = read(key)
  if (raw === null || raw === '') return null
  try {
    const parsed = JSON.parse(raw) as StoredSession | null
    const token = parsed?.refresh_token
    return typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

/**
 * The access token a previous sign-in left behind.
 *
 * Read for ONE purpose: the company id in its claims, which is what decides
 * whether the app opens on Home or on the business-setup screen. Expiry is
 * deliberately not checked — an expired token still says which business the
 * records on this device belong to, and that fact does not go stale. Nothing
 * is authorised with it; the server re-checks every claim on every request.
 */
export function storedAccessToken(read: ReadStorage, key: string): string | null {
  const raw = read(key)
  if (raw === null || raw === '') return null
  try {
    const parsed = JSON.parse(raw) as StoredSession | null
    const token = parsed?.access_token
    return typeof token === 'string' && token !== '' ? token : null
  } catch {
    return null
  }
}

/**
 * Did the server REFUSE the session, or did we simply fail to ask it?
 *
 * The whole guarantee turns on this. Refused means the token is dead and a
 * sign-in screen is right; unreachable means try again later and let the
 * person carry on working.
 *
 * Read conservatively: anything that is not recognisably a refusal is treated
 * as unreachable. Getting this wrong in that direction leaves a revoked
 * session usable offline until the next successful call, which is a far
 * smaller harm than signing a working person out on a train.
 */
export function refusedByServer(error: unknown): boolean {
  if (error === null || error === undefined) return false
  const status = (error as { status?: unknown }).status
  if (typeof status === 'number') {
    // 401/403 is a refusal. A 5xx is the server having a bad day, and any
    // network-level failure has no status at all.
    return status === 400 || status === 401 || status === 403
  }
  const message = String((error as { message?: unknown }).message ?? '').toLowerCase()
  if (message.includes('failed to fetch') || message.includes('network')) return false
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('already used') ||
    message.includes('revoked')
  )
}
