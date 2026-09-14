/**
 * The convert action (§G).
 *
 * "Convert offers only what makes sense … Originals are never altered; links
 * persist."
 *
 * So the sheet offers exactly what `conversionsFor` returns — nothing more,
 * and no greyed-out rows for pairs that make no sense, because a control that
 * cannot work is worse than one that is not there (§N).
 *
 * Three things it says out loud:
 *
 *  · **The original stays as it is.** People hesitate over "convert" because
 *    in most software it consumes the thing being converted. Here it does not,
 *    and the sheet says so before the tap rather than after.
 *  · **A delivery becoming an invoice needs prices**, because the delivery
 *    carried none (§G). Better to know before the builder's amber band.
 *  · **Already made one?** Then the offer becomes "open it" (§M — a retried
 *    conversion never duplicates, and a deliberate second one is a different
 *    question the owner should be asked, not given by accident).
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { label as typeLabel } from '../../domain/locale/profile'
import type { DocumentType } from '../../domain/documents/types'
import { carriesMoney } from '../../domain/documents/types'
import type { ConvertibleDocument } from './convert'
import { conversionsFor } from './convert'
import { useFocusOnOpen } from '../../ui'

export interface ConvertSheetProps {
  readonly document: ConvertibleDocument
  /** Which targets already exist, so the offer becomes "open it". */
  readonly existing: Readonly<Partial<Record<DocumentType, string>>>
  readonly onConvert: (to: DocumentType) => void
  readonly onOpen: (documentId: string) => void
  readonly onClose: () => void
  readonly error?: string
}

export function ConvertSheet({
  document,
  existing,
  onConvert,
  onOpen,
  onClose,
  error,
}: ConvertSheetProps) {
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { profile, strings } = useCompany()
  const options = conversionsFor(document)

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={strings.convert.title}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{strings.convert.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>

      {options.length === 0 ? (
        <p className="mt-2 text-sm opacity-70">{strings.convert.nothingToConvert}</p>
      ) : (
        <>
          <p className="mt-1 text-xs opacity-70">{strings.convert.originalUntouched}</p>

          <ul className="mt-3 space-y-2">
            {options.map((target) => {
              const word = typeLabel(profile, target)
              const made = existing[target]

              // A delivery carries no money, so an invoice made from one has
              // no prices to inherit (§G).
              const willNeedPrices =
                carriesMoney(target) &&
                document.lineItems.some((line) => line.unitPriceMinor === undefined)

              return (
                <li key={target}>
                  {made === undefined ? (
                    <button
                      type="button"
                      className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
                      onClick={() => onConvert(target)}
                    >
                      {format(strings.convert.turnInto, { label: word })}
                    </button>
                  ) : (
                    <div className="rounded-xl bg-ink/[0.04] p-3">
                      <p className="text-xs opacity-80">
                        {format(strings.convert.alreadyMade, { label: word })}
                      </p>
                      <button
                        type="button"
                        className="mt-2 min-h-tap w-full rounded-xl border border-edge/10 bg-surface text-sm font-semibold"
                        onClick={() => onOpen(made)}
                      >
                        {strings.convert.openIt}
                      </button>
                    </div>
                  )}

                  {made === undefined && willNeedPrices && (
                    <p className="mt-1 px-1 text-[11px] opacity-60">
                      {format(strings.convert.needsPrices, { label: word })}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
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
