/**
 * Something shown once and never again (§G, Rule #1).
 *
 * A first-run hint is a promise that it will stop. One that reappears is not
 * a hint, it is a nag — and Rule #1's "nothing may be harder than the legacy
 * app" includes not making somebody dismiss the same sentence every Tuesday.
 *
 * `localStorage`, deliberately, and not the company record:
 *
 *  · it is about this INSTALL, not this business. Two people sharing a
 *    company each deserve the hint once, and neither should lose it because
 *    the other has already read it;
 *  · it must never sync. A hint riding the outbox would be a write competing
 *    with real work on the connection §M assumes is bad;
 *  · and it may be lost harmlessly. A cleared browser showing the hint again
 *    is the worst thing that can happen here, which is not very bad.
 *
 * A REFUSAL READS AS "ALREADY SEEN". A locked-down WebView that throws on
 * `localStorage` would otherwise show the hint on every single render, which
 * is the one failure mode worse than never showing it at all.
 */

const PREFIX = 'docflow.seen.'

export function hasSeen(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(PREFIX + key) === '1'
  } catch {
    // Storage refused. Treat it as seen: a hint on every render is worse
    // than no hint, and there is no way to remember having shown one.
    return true
  }
}

export function markSeen(key: string): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, '1')
  } catch {
    // Nothing to do, and nothing worth saying: the hint simply may return.
  }
}
