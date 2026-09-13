/**
 * Saying, out loud, that this is a demo (§R, §N).
 *
 * §R: "a local demo is never passed off as an account." A demo that merely
 * looks like the app IS passing itself off as one — the owner has no way to
 * tell, and the first they would learn of it is when the records are not there
 * on another device.
 *
 * So it is stated where it cannot be missed, on every screen, and it says the
 * two things that actually matter to someone using it: the records are on this
 * device only, and nothing is saved to an account.
 */

import { stringsFor } from '../domain/locale/data/strings'

export function DemoBanner() {
  const a = stringsFor('en').account

  return (
    <div
      className="sticky top-0 z-50 bg-status-warn-tint px-4 py-2 text-center text-[11px] font-medium text-status-warn"
      role="status"
    >
      <span className="font-bold">{a.demoTitle}</span> · {a.demoBody}
    </div>
  )
}
