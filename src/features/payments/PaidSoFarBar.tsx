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
import { TYPE_PALETTE } from '../../ui'

/** The bar is invoice-only, so its colour is the invoice's (§F). */
const invoice = TYPE_PALETTE.invoice

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
    /*
     * §G's "blue paid-so-far bar over green progress", and the reference
     * makes it a filled CARD rather than a tinted panel — the invoice's own
     * three stops, white text, and its accent thrown as the shadow.
     *
     * Green for the fill is the one colour here that is not the type's: money
     * that has arrived is green everywhere in this app (§F), and a blue bar
     * filling with blue would say nothing at a glance.
     */
    <section
      className="relative overflow-hidden rounded-[18px] p-[13px] text-white"
      style={{
        backgroundImage: `linear-gradient(140deg, ${invoice.light}, ${invoice.accent} 68%, ${invoice.deep})`,
        boxShadow: `0 16px 30px -10px ${invoice.accent}99, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
      }}
    >
      <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[10.5px]">
        <span className="text-white/90">{spoken}</span>
        {!bar.isSettled && (
          <b className="shrink-0 tabular-nums">
            {format(strings.payments.amountLeft, { amount: formatMoney(bar.left) })}
          </b>
        )}
      </p>

      <div
        className="h-[9px] overflow-hidden rounded-full bg-on-accent/25 shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)]"
        role="progressbar"
        aria-label={spoken}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]"
          style={{
            width: `${percent}%`,
            backgroundImage: 'linear-gradient(180deg, #7ee0bb, #43bf94)',
          }}
        />
      </div>

      {bar.credited.minor !== 0 && (
        // Its own line, never folded into "paid": a credit is money written
        // off, not money received (Rule #3, §V).
        <p className="mt-1.5 text-[10px] text-white/80">
          {format(strings.payments.creditedLine, { amount: formatMoney(bar.credited) })}
        </p>
      )}
      {bar.isSettled && (
        <p className="mt-1.5 text-[10px] font-medium text-white/90">{strings.payments.settled}</p>
      )}
    </section>
  )
}
