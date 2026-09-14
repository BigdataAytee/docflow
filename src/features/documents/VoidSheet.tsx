/**
 * Cancelling a document (Rule #5, §G).
 *
 * The sheet's job is mostly to be honest about what cancelling is and is not:
 *
 *  · It is not a delete. The document stays, marked cancelled, and the sheet
 *    says so before the tap — §M never silently overwrites an issued document,
 *    and an owner who expects a delete should find out here, not later.
 *  · It never touches money already recorded. Payments are the ledger (Rule
 *    #3); cancelling a piece of paper cannot un-receive cash.
 *  · When money HAS come in against an invoice, cancelling is refused — and
 *    the refusal names the two real routes out rather than dead-ending.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { EmptyState } from '../../ui'
import type { VoidableDocument } from './void'
import { alternativesFor, reasonsVoidIsBlocked } from './void'
import type { CreditNote, Payment } from '../../domain/payments/ledger'

export interface VoidSheetProps {
  readonly document: VoidableDocument
  readonly payments: readonly Payment[]
  readonly creditNotes?: readonly CreditNote[]
  readonly onVoid: (reason: string) => void
  readonly onCreditInstead: () => void
  readonly onClose: () => void
  readonly error?: string
}

export function VoidSheet({
  document,
  payments,
  creditNotes = [],
  onVoid,
  onCreditInstead,
  onClose,
  error,
}: VoidSheetProps) {
  const { strings } = useCompany()
  const v = strings.voidIt

  const [reason, setReason] = useState('')

  const blockers = reasonsVoidIsBlocked(document, payments)
  const alternatives = alternativesFor(document, payments, creditNotes)

  return (
    <section className="rounded-2xl bg-surface/85 p-4 backdrop-blur" aria-label={v.title}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{v.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>

      {blockers.includes('already_void') && (
        <p className="mt-2 text-sm opacity-70">{v.alreadyVoid}</p>
      )}

      {blockers.includes('not_a_transition') && (
        <p className="mt-2 text-sm opacity-70">{v.notAllowed}</p>
      )}

      {blockers.includes('money_received') && (
        <div className="mt-3">
          <EmptyState title={v.moneyReceived} />
          <ul className="mt-3 space-y-2">
            {alternatives.map((alternative) => (
              <li key={alternative}>
                {alternative === 'credit_the_balance' ? (
                  <button
                    type="button"
                    className="min-h-tap w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white"
                    onClick={onCreditInstead}
                  >
                    {v.creditTheBalance}
                  </button>
                ) : (
                  // Reversing is done on the payment itself, where the record
                  // lives — this only says so, rather than offering a second
                  // route into the ledger.
                  <p className="rounded-xl bg-ink/[0.04] px-3 py-2.5 text-xs opacity-80">
                    {v.reverseThePayment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blockers.length === 0 && (
        <>
          <p className="mt-1 text-xs opacity-70">{v.explain}</p>
          <p className="mt-1 text-xs opacity-70">
            {document.type === 'receipt' ? v.receiptPaymentStays : v.paymentsStay}
          </p>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium opacity-70">{v.why}</span>
            <input
              className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
              aria-label={v.why}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="mt-4 min-h-tap w-full rounded-xl bg-status-bad px-4 text-sm font-semibold text-white disabled:opacity-40"
            disabled={reason.trim() === ''}
            onClick={() => onVoid(reason.trim())}
          >
            {v.confirm}
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
