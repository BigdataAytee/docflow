/**
 * Which step of the builder somebody was on, across a trip out of it (§G).
 *
 * THE BUILDER HAS ONE EXIT THAT COMES BACK: the Saved items list, reached
 * from the Items step's small control. It is a Settings route, so going there
 * leaves the builder screen entirely — and coming back remounted it at step
 * ZERO. Somebody who opened their saved items from Items returned to Details
 * and had to find their way forward again, past two steps they had already
 * done, on the one screen where losing your place is most annoying.
 *
 * Found by walking it on the phone. Nothing tested it because nothing knew
 * the round trip existed: each screen is correct on its own.
 *
 * SESSION STORAGE, NOT THE RECORD. Which step you are looking at is not a
 * fact about the document — it must never reach the ledger, it must not sync,
 * and it must not survive the app being closed and reopened, because coming
 * back tomorrow to step four of a document you half-remember is worse than
 * starting at the top. A session is exactly the right lifetime.
 *
 * KEYED BY DOCUMENT, so two drafts do not inherit each other's position.
 *
 * Every access is wrapped: a private window, cleared site data, or a WebView
 * with storage disabled all throw here, and none of them are a reason for the
 * builder to fail to open. A throw means "no remembered step", which is the
 * behaviour this module replaced.
 */

const KEY = 'docflow.builder.step'

const store = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Remembers the step for this document. Silent if storage is unavailable. */
export function rememberStep(documentId: string, step: number): void {
  try {
    store()?.setItem(`${KEY}.${documentId}`, String(step))
  } catch {
    // A session without storage simply does not remember. See above.
  }
}

/**
 * The step to open at, or 0.
 *
 * READ ONCE AND CLEARED. The remembered step exists to survive ONE trip out
 * to the saved items and back; leaving it behind would mean closing the
 * builder and opening the same draft an hour later dropped somebody into the
 * middle of it, which is the opposite of the problem this solves.
 */
export function takeStep(documentId: string): number {
  try {
    const held = store()?.getItem(`${KEY}.${documentId}`)
    store()?.removeItem(`${KEY}.${documentId}`)
    if (held === null || held === undefined) return 0
    const step = Number.parseInt(held, 10)
    return Number.isInteger(step) && step >= 0 ? step : 0
  } catch {
    return 0
  }
}
