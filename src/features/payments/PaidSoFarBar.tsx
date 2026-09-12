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

  // No aria-label on the section: the line below is its visible text, and the
  // progress bar needs that name as a widget — two elements sharing one
  // accessible name is one too many for anyone navigating by label.
  return (
    <section className="rounded-2xl bg-invoice-tint p-4">
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
      {bar.credited.minor !== 0 && (
        // Its own line, never folded into "paid": a credit is money written
        // off, not money received (Rule #3, §V).
        <p className="mt-1.5 text-xs text-invoice-deep/80">
          {format(strings.payments.creditedLine, { amount: formatMoney(bar.credited) })}
        </p>
      )}
      {bar.isSettled && (
        <p className="mt-1.5 text-xs font-medium text-status-good">{strings.payments.settled}</p>
      )}
    </section>
  )
}
