/**
 * The blue band over a Settings panel reached from a draft (§G, §J).
 *
 * §G describes this exactly: an amber "Set up payment" that "carries into
 * Settings under a blue return band — 'Setting up payment for your document ·
 * Back to draft' — and returns with the draft intact."
 *
 * It was the half that never got built. The builder navigated to the payment
 * panel and left the person there: no statement of why they had moved, and no
 * way back except the system back gesture, which on a phone is the one thing
 * people avoid mid-task for fear of losing what they typed. So the detour
 * that was meant to take ten seconds became a reason not to start.
 *
 * WHAT MAKES IT SAFE is not this component. The draft is autosaved on debounce
 * and on step change (§G), so it is already on the device before the tap that
 * navigates away — the band promises the draft is intact because it is, not
 * because going back through this button preserves anything the system back
 * gesture would not.
 */

import { useCompany } from '../../app/context'
import { Icon } from '../../ui'

export interface ReturnBandProps {
  /** What the person came here to finish, in words already resolved. */
  readonly errand: string
  readonly onBack: () => void
}

export function ReturnBand({ errand, onBack }: ReturnBandProps) {
  const { strings } = useCompany()

  return (
    <div
      // `status`, not `alert`: nothing has gone wrong. It is a note about
      // where they are, and it must not interrupt a screen reader mid-word.
      role="status"
      className="flex items-center gap-2.5 bg-gradient-to-b from-brand-light to-brand px-4 py-2.5 text-on-accent"
    >
      <span aria-hidden="true" className="shrink-0 opacity-90">
        <Icon name="arrow-left" size={0.85} />
      </span>
      <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug">{errand}</span>
      {/*
        `on-accent`, not a literal white. That token is exactly this case —
        "white on a locked accent ... fixed in both themes like the accent
        beneath it" — so the band and the chip that lifts off it make one
        decision rather than two that could disagree. The dark-mode sweep
        caught the literal.
      */}
      <button
        type="button"
        onClick={onBack}
        className="min-h-tap shrink-0 rounded-full bg-on-accent/20 px-3 text-[11px] font-semibold"
      >
        {strings.details.backToDraft}
      </button>
    </div>
  )
}
