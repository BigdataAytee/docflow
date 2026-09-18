/**
 * A picture of the goods, on one line of the Items step (§G step 2, §I).
 *
 * SMALL AND QUIET, which is the whole design constraint. §G asks for "a card
 * with optional photo", and optional here has to mean genuinely ignorable:
 * most traders will not attach one most of the time, and Rule #1 says that
 * costing them nothing includes the width of a label and the suggestion that
 * something is missing. So a row without a photo shows a camera the same size
 * as the delete button already beside it, and reads as finished.
 *
 * Attached, it becomes the thumbnail itself — tapping it replaces, the small
 * cross removes. Two taps to change your mind, no menu to open, and the
 * picture is its own control rather than a caption saying one is there.
 *
 * It shrinks HARD before handing anything over: `shrinkItemPhoto` puts a
 * printed thumbnail at 320px, because these documents go out over WhatsApp on
 * metered data and a several-megabyte PDF is not slow, it is unsent.
 */

import { useId, useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { Icon } from '../../ui'
import { ACCEPTED, PhotoError, shrinkItemPhoto } from './resize'

export interface ItemPhotoProps {
  /** The line this belongs to, for the labels a screen reader reads out. */
  readonly itemName: string
  /** The attached photo, already resolved to a data URL. */
  readonly currentUrl?: string
  /** Called with the shrunk data URL. Storing it is the caller's job. */
  readonly onPhoto: (dataUrl: string) => void | Promise<void>
  readonly onRemove: () => void
}

export function ItemPhoto({ itemName, currentUrl, onPhoto, onRemove }: ItemPhotoProps) {
  const { strings } = useCompany()
  const input = useRef<HTMLInputElement | null>(null)
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = () => input.current?.click()

  return (
    <span className="relative shrink-0">
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPTED}
        /*
         * The rear camera on a phone, a file picker on a desktop — and on
         * Android the chooser still offers the gallery beside the camera, so
         * "camera or gallery" costs no second control.
         */
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared, so choosing the SAME file twice still fires a change.
          event.target.value = ''
          if (file === undefined) return

          setProblem(null)
          setBusy(true)
          void shrinkItemPhoto(file)
            .then((dataUrl) => onPhoto(dataUrl))
            .catch((cause: unknown) => {
              setProblem(
                cause instanceof PhotoError && cause.field === 'not_an_image'
                  ? strings.photo.notAnImage
                  : format(strings.photo.failed, {
                      reason: cause instanceof Error ? cause.message : String(cause),
                    }),
              )
            })
            .finally(() => setBusy(false))
        }}
      />

      {currentUrl === undefined ? (
        <button
          type="button"
          disabled={busy}
          onClick={pick}
          data-add-photo
          aria-label={format(strings.photo.addToItem, { item: itemName })}
          className="tap-scale grid min-h-tap min-w-tap place-items-center rounded-lg opacity-45 disabled:opacity-20"
        >
          <Icon name="camera" size={0.85} />
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={pick}
            data-item-photo
            aria-label={format(strings.photo.replaceOnItem, { item: itemName })}
            className="tap-scale block h-9 w-9 overflow-hidden rounded-lg border border-edge/10"
          >
            <img
              src={currentUrl}
              alt={format(strings.photo.onItem, { item: itemName })}
              className="h-full w-full object-cover"
            />
          </button>
          {/*
            REMOVE, as a mark on the picture rather than a third control in
            the row. It is deliberately small: taking a photo off is rarer
            than putting one on, and a row of equal-weight buttons is the
            clutter this control exists to avoid.
          */}
          <button
            type="button"
            onClick={onRemove}
            aria-label={format(strings.photo.removeFromItem, { item: itemName })}
            className="absolute -end-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[9px] leading-none text-surface"
          >
            ✕
          </button>
        </>
      )}

      {problem !== null && (
        <span role="alert" className="sr-only">
          {problem}
        </span>
      )}
    </span>
  )
}
