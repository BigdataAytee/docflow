/**
 * Issuing a credit note (Rule #5, §E).
 *
 * The middle correction: the invoice the customer already holds is never
 * touched, and a separate record says part of it is no longer owed.
 *
 * The arithmetic is `issueCreditNote`'s, not this screen's — including the cap
 * at the invoice total, which is the rule that stops a credit turning into a
 * refund by accident. The sheet's job is to show how much is still creditable
 * and to say, out loud, that this does not move money already received.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { type Money, money } from '../../domain/money/money'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import type { CreditNote } from '../../domain/payments/ledger'
import { formatMoney } from '../customers/formatMoney'
import { creditableRemaining } from './issue'
import { useFocusOnOpen } from '../../ui'

export interface CreditNoteSheetProps {
  readonly invoiceId: string
  readonly invoiceReference: string
  readonly invoiceTotal: Money
  readonly existing: readonly CreditNote[]
  readonly onIssue: (input: { amount: Money; reason: string }) => void
  readonly onClose: () => void
  readonly error?: string
}

export function CreditNoteSheet({
  invoiceId,
  invoiceReference,
  invoiceTotal,
  existing,
  onIssue,
  onClose,
  error,
}: CreditNoteSheetProps) {
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const c = strings.credits

  const remaining = creditableRemaining(invoiceId, invoiceTotal, existing)

  const [major, setMajor] = useState('')
  const [reason, setReason] = useState('')

  const scale = minorUnitsFor(invoiceTotal.currency)
  const parsed = Number.parseFloat(major.replace(/,/g, ''))
  const minor = Number.isFinite(parsed) ? Math.round(parsed * scale) : 0

  const canIssue = minor > 0 && minor <= remaining.minor && reason.trim() !== ''

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="rounded-2xl bg-surface/85 p-4 outline-none backdrop-blur"
      aria-label={c.sheetTitle}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{c.sheetTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>

      <p className="mt-1 text-xs opacity-70">
        {format(c.against, { reference: invoiceReference })}
      </p>

      {remaining.minor === 0 ? (
        <p className="mt-3 text-sm opacity-70">{c.nothingLeft}</p>
      ) : (
        <>
          <p className="mt-3 text-xs opacity-80">
            {format(c.howMuchLeft, { amount: formatMoney(remaining) })}
          </p>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium opacity-70">{c.amount}</span>
            <input
              className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-lg tabular-nums"
              inputMode="decimal"
              aria-label={c.amount}
              value={major}
              onChange={(event) => setMajor(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-2 min-h-tap rounded-full border border-edge/10 bg-surface px-3 text-xs font-medium"
            onClick={() => setMajor(String(remaining.minor / scale))}
          >
            {c.creditAll}
          </button>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium opacity-70">{c.reason}</span>
            <input
              className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
              aria-label={c.reason}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <p className="mt-3 text-[11px] opacity-60">{c.neverMovesIncome}</p>

          <button
            type="button"
            className="mt-3 min-h-tap w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!canIssue}
            onClick={() =>
              onIssue({
                amount: money(invoiceTotal.currency, minor),
                reason: reason.trim(),
              })
            }
          >
            {c.issue}
          </button>
        </>
      )}

      {error !== undefined && (
        <p
          className="mt-3 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
