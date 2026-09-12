/**
 * The paid-so-far bar (§G, §L3).
 *
 * "A blue paid-so-far bar ('₦50,000 paid of ₦145,000 · ₦95,000 left') over
 * green progress."
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { formatMoney } from '../customers/formatMoney'
import type { PaidSoFar } from './record'

export function PaidSoFarBar({ bar }: { bar: PaidSoFar }) {
  const { strings } = useCompany()
  const percent = Math.max(0, Math.min(100, bar.progress * 100))

  // Resolved, not the raw template: an aria-label of "{paid} paid of {total}"
  // is announced with its braces, which is worse than no label at all.
  const spoken = format(strings.payments.paidOfTotal, {
    paid: formatMoney(bar.paid),
    total: formatMoney(bar.total),
  })

  return (
    <section className="rounded-2xl bg-invoice-tint p-4" aria-label={spoken}>
      <p className="text-sm font-semibold text-invoice-deep">
        {spoken}
        {!bar.isSettled && (
          <>
            {' · '}
            {format(strings.payments.amountLeft, { amount: formatMoney(bar.left) })}
          </>
        )}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/70"
        role="progressbar"
        aria-label={spoken}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-status-good" style={{ width: `${percent}%` }} />
      </div>
      {bar.isSettled && (
        <p className="mt-1.5 text-xs font-medium text-status-good">{strings.payments.settled}</p>
      )}
    </section>
  )
}
