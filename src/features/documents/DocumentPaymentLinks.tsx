/**
 * Adding a way to be paid without leaving the invoice (§J, §G, Rule #1).
 *
 * The trader is mid-invoice and realises this customer should pay by MoMo.
 * Leaving for Settings, finding the right panel, setting it up and coming
 * back is four screens and a lost place, and the draft they were halfway
 * through is the thing they are most afraid of losing. So the same list opens
 * here, in the same order, with the same paste behaviour — one component, so
 * "both doors produce the same thing" is true by construction rather than by
 * somebody keeping two screens in step.
 *
 * WHAT "THIS DOCUMENT ONLY" MEANS. `draft.paymentLinks` is absent on almost
 * every document, and absent means "whatever the business has". The moment
 * somebody adds or removes one HERE, the list is materialised from the
 * defaults and the change applied to the copy — so switching MoMo off for one
 * awkward customer changes that invoice and nothing else, and an issued
 * document keeps what it was issued with whatever Settings does next month
 * (Rule #5).
 *
 * AND THE DEFAULT IS SAVED, NOT ASKED ABOUT. A trader who pastes their PayPal
 * link wants their PayPal link; making them answer a question about future
 * documents before they can get back to this one is a form where a decision
 * was not needed. So it is saved to the defaults too and SAID, with one tap
 * to make it this-document-only. Done-with-undo rather than a prompt: the
 * common answer costs nothing, the rare one costs a tap, and neither costs a
 * screen.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import type { SavedPaymentLink } from '../../domain/payments/links'
import { PaymentLinkSection } from '../settings/PaymentLinkSection'

export interface DocumentPaymentLinksProps {
  /** Where the trader is — the same detected region Settings reads. */
  readonly country: string
  /** The business's defaults, which this document starts from. */
  readonly defaults: readonly SavedPaymentLink[]
  /** This document's own list, when it has one (§J). */
  readonly own: readonly SavedPaymentLink[] | undefined
  readonly onDocument: (links: readonly SavedPaymentLink[]) => void
  readonly onDefaults: (links: readonly SavedPaymentLink[]) => void
}

export function DocumentPaymentLinks({
  country,
  defaults,
  own,
  onDocument,
  onDefaults,
}: DocumentPaymentLinksProps) {
  const { strings } = useCompany()
  const [open, setOpen] = useState(false)
  /** The provider just saved to the defaults, while the undo is still offered. */
  const [justSaved, setJustSaved] = useState<string | null>(null)

  /*
   * MATERIALISED ON FIRST TOUCH. Until somebody changes something here the
   * document has no list of its own, and inherits — which is what keeps a
   * document that never thought about payment links costing nothing.
   */
  const current = own ?? defaults

  const change = (next: readonly SavedPaymentLink[]) => {
    onDocument(next)

    /*
     * ADDED HERE, SO ADDED EVERYWHERE, unless they say otherwise. Only an
     * ADDITION travels: removing a method for one customer is exactly the
     * per-document decision this control exists for, and pushing that into
     * the defaults would delete an account from every future invoice
     * because of one awkward job.
     */
    const added = next.find(
      (link) => !defaults.some((existing) => existing.provider === link.provider),
    )
    if (added === undefined) return setJustSaved(null)

    onDefaults([...defaults.filter((link) => link.provider !== added.provider), added])
    setJustSaved(added.provider)
  }

  /** One tap back to this-document-only. The link stays on the document. */
  const keepItHere = () => {
    if (justSaved === null) return
    onDefaults(defaults.filter((link) => link.provider !== justSaved))
    setJustSaved(null)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-add-payment-method
        className="glass-pill tap-scale min-h-tap rounded-full px-3 text-xs font-semibold text-brand"
      >
        + {strings.settings.addToThisDocument}
      </button>
    )
  }

  return (
    <div className="mt-1 space-y-2.5">
      {/* Said before anything is changed, because it is the whole point. */}
      <p className="text-[11px] opacity-60">{strings.settings.onlyThisDocument}</p>

      <PaymentLinkSection country={country} links={current} onChange={change} />

      {justSaved !== null && (
        <p
          className="flex items-center justify-between gap-3 rounded-xl bg-status-good-tint px-3 py-2 text-[11px] font-medium text-status-good"
          role="status"
        >
          {strings.settings.savedAsDefault}
          <button
            type="button"
            onClick={keepItHere}
            className="min-h-tap shrink-0 underline"
          >
            {strings.settings.undoDefault}
          </button>
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen(false)
          setJustSaved(null)
        }}
        className="min-h-tap w-full rounded-xl border border-edge/10 bg-surface text-xs font-semibold"
      >
        {strings.settings.doneWithLinks}
      </button>
    </div>
  )
}
