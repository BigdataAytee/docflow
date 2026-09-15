/**
 * Whether the welcome has been left (§R).
 *
 * The ONE part of "should this person see the welcome?" that cannot be
 * derived. Everything else is a question about the company — has it a name,
 * has it any documents — but "I have seen this and chose to look around"
 * exists nowhere except in having been told.
 *
 * `localStorage`, like the Home checklist's dismissal, and not the company
 * record: it is a fact about this install rather than about the business, and
 * a second device signing into the same account has genuinely not seen it.
 *
 * Every access is guarded. A private window, cleared site data, or a WebView
 * with storage disabled all make this throw rather than return null, and the
 * failure mode of an unguarded read is that the app does not start.
 */

const KEY = 'docflow.onboarded'

export function onboardingDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1'
  } catch {
    // Unknown reads as "not yet", so the worst case is being asked again —
    // never a first run that cannot be got past.
    return false
  }
}

export function dismissOnboarding(): void {
  try {
    globalThis.localStorage?.setItem(KEY, '1')
  } catch {
    // Nothing to do: the welcome simply appears once more next launch.
  }
}
