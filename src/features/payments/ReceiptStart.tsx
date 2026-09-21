/**
 * The two ways a receipt begins (§G, Rule #1).
 *
 * THE FAILURE THIS ANSWERS. The owner built this app and could not work out
 * how to create a receipt. The form opened on "Who paid?" — a dropdown of
 * existing customers — which is the wrong first question for the commonest
 * case on the screen: cash handed over by somebody who is not in the book
 * yet. To get a receipt for that you had to know, without being told, that a
 * receipt is evidence of a payment and that the payment comes first.
 *
 * So the screen asks the one thing that actually divides the two journeys,
 * in words anybody can sort themselves into:
 *
 *   · money coming in against something already billed, or
 *   · money coming in from a sale happening now.
 *
 * NO EXPLANATION UNDER EITHER. A line of help under a choice is an admission
 * that the choice does not explain itself, and §G caps this at the smallest
 * thing that works. If somebody needs a paragraph to pick, the words are
 * wrong and the words should change.
 *
 * The LEDGER IS UNCHANGED by any of this. Both paths record a real payment
 * and derive the receipt from it (§V); what differs is only which questions
 * are worth asking first.
 */

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'

export interface ReceiptStartProps {
  readonly onOwed: () => void
  readonly onCash: () => void
  readonly onClose: () => void
  /**
   * Whether anybody owes anything.
   *
   * With an empty ledger the first path leads to an empty picker, so it is
   * SAID rather than offered — §N's rule, and the alternative is a dead end
   * somebody has to back out of to discover why.
   */
  readonly anyoneOwes: boolean
}

export function ReceiptStart({ onOwed, onCash, onClose, anyoneOwes }: ReceiptStartProps): ReactNode {
  const { strings } = useCompany()
  const r = strings.newReceipt

  return (
    <section className="glass-solid rounded-2xl p-4" aria-label={r.title}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{r.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-70"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <button
          type="button"
          onClick={onOwed}
          disabled={!anyoneOwes}
          className={`min-h-tap w-full rounded-2xl px-4 py-3.5 text-start text-sm font-semibold ${
            anyoneOwes
              ? 'raised tap-scale bg-surface text-brand-ink'
              : 'cursor-not-allowed border border-edge/10 bg-ink/[0.04] text-ink/35'
          }`}
        >
          {r.pathOwed}
          {!anyoneOwes && (
            // §N: an unavailable path says why rather than sitting grey.
            <span className="mt-0.5 block text-[11px] font-normal opacity-80">{r.nobodyOwes}</span>
          )}
        </button>

        <button
          type="button"
          onClick={onCash}
          className="raised tap-scale min-h-tap w-full rounded-2xl bg-surface px-4 py-3.5 text-start text-sm font-semibold text-brand-ink"
        >
          {r.pathCash}
        </button>
      </div>
    </section>
  )
}
