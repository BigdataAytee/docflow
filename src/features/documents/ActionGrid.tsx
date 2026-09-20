/**
 * §G's four actions, as a 2×2 grid (§G, §N, §F).
 *
 * The saved document used to stack full-width buttons that appeared and
 * disappeared as the delivery lifecycle advanced. §G asks for four per type,
 * and the reference draws exactly four pills — so the grid keeps its shape and
 * a pill that cannot act yet goes dark WITH THE REASON under it rather than
 * vanishing.
 *
 * That is the §N rule applied to a layout: an owner who sees "Copy signing
 * link — Send it on its way first" has learnt how the delivery works. An owner
 * whose button quietly appears on Thursday has learnt nothing, and one who
 * taps a greyed pill that says nothing has been told off by the software.
 */

import type { ReactNode } from 'react'

import type { ActionBlocker, ActionId, DocumentAction } from './actions'
import type { UiStrings } from '../../domain/locale/data/strings'

export interface ActionGridProps {
  readonly actions: readonly DocumentAction[]
  readonly strings: UiStrings
  /** What each live pill does. An action with no handler is never drawn live. */
  readonly onAction: (id: ActionId) => void
}

const LABEL: Record<ActionId, (s: UiStrings['savedDocument']['action']) => string> = {
  share_pdf: (a) => a.sharePdf,
  convert: (a) => a.convert,
  record_payment: (a) => a.recordPayment,
  chase: (a) => a.chase,
  copy_accept_link: (a) => a.copyAcceptLink,
  they_paid: (a) => a.theyPaid,
  duplicate_rev2: (a) => a.duplicateRev2,
  void_and_reissue: (a) => a.voidAndReissue,
  open_invoice: (a) => a.openInvoice,
  copy_signing_link: (a) => a.copySigningLink,
  add_photo: (a) => a.addPhoto,
}

const REASON: Record<ActionBlocker, (s: UiStrings['savedDocument']['blocked']) => string> = {
  not_issued: (b) => b.notIssued,
  not_dispatched: (b) => b.notDispatched,
  sealed: (b) => b.sealed,
  voided: (b) => b.voided,
  no_invoice: (b) => b.noInvoice,
  nothing_to_convert: (b) => b.nothingToConvert,
  nothing_owed: (b) => b.nothingOwed,
  no_payment: (b) => b.noPayment,
}

export function ActionGrid({ actions, strings, onAction }: ActionGridProps): ReactNode {
  const s = strings.savedDocument

  return (
    <div
      className="grid grid-cols-2 gap-2.5"
      role="group"
      aria-label={s.actions}
      data-action-grid
    >
      {actions.map((action) => {
        const label = LABEL[action.id](s.action)
        const reason = action.blockedBy === undefined ? null : REASON[action.blockedBy](s.blocked)

        return (
          <button
            key={action.id}
            type="button"
            disabled={!action.enabled}
            /*
             * The NAME is the action; the reason is a description.
             *
             * Both lines live inside the button, so without this the
             * accessible name became "Copy signing link Send it on its way
             * first" — one string that changes as the document's state
             * changes. A screen reader announced the reason as part of the
             * control's name, and anything looking the control up by name
             * had to know the reason to find it.
             */
            aria-label={label}
            /*
             * The reason is the ACCESSIBLE DESCRIPTION as well as the visible
             * line. A screen reader landing on a disabled control otherwise
             * hears "Copy signing link, dimmed" and nothing about why — which
             * is the same failure as a silent grey pill, for somebody who
             * cannot see the grey.
             */
            {...(reason === null ? {} : { 'aria-describedby': `action-why-${action.id}` })}
            onClick={() => onAction(action.id)}
            className={`min-h-tap rounded-2xl px-3 py-2.5 text-center text-[12.5px] font-semibold ${
              action.enabled
                ? 'raised tap-scale bg-surface text-brand'
                : 'cursor-not-allowed border border-edge/10 bg-ink/[0.04] text-ink/35'
            }`}
          >
            <span className="block">{label}</span>
            {reason !== null && (
              <span
                id={`action-why-${action.id}`}
                className="mt-0.5 block text-[10px] font-normal leading-tight opacity-80"
              >
                {reason}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
