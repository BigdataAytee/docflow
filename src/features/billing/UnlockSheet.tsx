/**
 * "Statements are part of Pro" (§U, Rule #1, Rule #6).
 *
 * §U: "contextual unlock sheets exactly where a gated feature is tapped …
 * each with the price, the trial, and a no-hard-feelings dismiss. No modal
 * ambushes, no fake urgency, no feature that silently produces a paywall
 * after work is done."
 *
 * The shape of this component is the rule. It takes an OFFER — which
 * `src/domain/billing/unlock.ts` refuses to produce without a price, a trial
 * and an announcement point — so there is no path through this file that
 * renders a sheet with a blank price or a mystery cost. It cannot ambush,
 * because it cannot be built without the things an ambush leaves out.
 *
 * What it will not grow: a countdown, a "last chance", a dismiss smaller or
 * quieter than the buy button, or any copy that implies the person is losing
 * something by saying no. The dismiss is first in the DOM and identical in
 * weight, which is also what makes it the first thing a screen reader
 * reaches.
 */

import type { Offer } from '../../domain/billing/unlock'
import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { formatMoney } from '../customers/formatMoney'
import { money } from '../../domain/money/money'
import { useFocusOnOpen } from '../../ui'

export interface UnlockSheetProps {
  /** Never optional and never partial: no offer, no sheet. */
  readonly offer: Offer
  /** What this feature is called, in the active language. */
  readonly featureName: string
  readonly onDismiss: () => void
  readonly onSeePlan: () => void
}

export function UnlockSheet({ offer, featureName, onDismiss, onSeePlan }: UnlockSheetProps) {
  // Opening this panel moves focus into it, and its name is announced. The
  // sweep in `src/sweeps/announce.test.tsx` caught this file the day it was
  // written — which is what it is for.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const p = strings.pro
  const { price } = offer

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={format(p.partOfPro, { feature: featureName })}
    >
      <h2 className="text-sm font-semibold">{format(p.partOfPro, { feature: featureName })}</h2>

      {/*
        The price, in words, before anything else. §U puts it on the sheet and
        the domain refuses to make an offer without it — so this cannot render
        "Upgrade to find out".
      */}
      <p className="mt-2 text-sm">
        {format(p.perMonth, {
          price: formatMoney(money(price.currency, price.monthlyMinor)),
        })}
        {' · '}
        {format(p.perYear, {
          price: formatMoney(money(price.currency, price.annualMinor)),
        })}
      </p>
      {price.trialDays > 0 && (
        <p className="mt-1 text-sm font-medium text-status-good">
          {format(p.freeTrial, { days: price.trialDays })}
        </p>
      )}

      {/* Rule #6, said to the person rather than only in the spec. */}
      <p className="mt-3 text-xs opacity-70">{p.freeForever}</p>

      <div className="mt-4 flex gap-2">
        {/*
          Dismiss FIRST, and the same size. §U's "no-hard-feelings dismiss" is
          not satisfied by a grey link under a bright button, and putting it
          first is also what a screen reader reaches first.
        */}
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-tap min-w-0 flex-1 rounded-xl bg-surface text-sm font-semibold"
        >
          {p.notNow}
        </button>
        <button
          type="button"
          onClick={onSeePlan}
          className="raised tap-scale min-h-tap min-w-0 flex-1 rounded-xl bg-gradient-to-b from-brand-light to-brand text-sm font-semibold text-white"
        >
          {p.seePlan}
        </button>
      </div>
    </section>
  )
}
