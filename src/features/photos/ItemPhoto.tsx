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
 *
 * CAMERA *OR* GALLERY, ASKED EXPLICITLY, and it took two walks to get here.
 * The first found `capture="environment"` going straight to the viewfinder,
 * so a trader who had photographed the goods that morning could not reach the
 * shot. Removing the attribute was supposed to make Android show its own
 * chooser — and on this phone it does not: a WebView file input now opens
 * the system PHOTO PICKER, which is the gallery and nothing else. Camera-only
 * became gallery-only, and §G asks for both.
 *
 * So the app asks, rather than hoping the OS will. Two hidden inputs, one
 * with `capture` and one without, behind one quiet control — the row is
 * unchanged for somebody who never attaches a photo, and the extra tap only
 * exists for somebody who has already decided to. Nothing here depends on
 * what a given Android version does with a bare file input, which is the
 * assumption that broke twice.
 */

import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const camera = useRef<HTMLInputElement | null>(null)
  const gallery = useRef<HTMLInputElement | null>(null)
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /*
   * WHERE TO DRAW THE MENU, measured rather than positioned relatively.
   *
   * Every row in the Items list is `glass`, and `backdrop-filter` creates a
   * stacking context — so a menu inside a row paints UNDER the rows after it
   * whatever its z-index, and on the phone it came out as a white sliver
   * trapped between two cards. It is drawn into `document.body` instead,
   * which is the only place outside all of them.
   */
  const [asking, setAsking] = useState<{ top: number; right: number } | null>(null)

  const accept = (file: File | undefined) => {
    if (file === undefined) return
    setAsking(null)
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
  }

  const pick = (event: { currentTarget: HTMLElement }) => {
    if (asking !== null) return setAsking(null)
    const box = event.currentTarget.getBoundingClientRect()
    setAsking({ top: box.bottom + 4, right: window.innerWidth - box.right })
  }

  return (
    <span className="relative shrink-0">
      {/*
        TWO INPUTS, ONE PER ANSWER.

        `capture="environment"` does not mean "offer the camera", it means GO
        STRAIGHT TO IT — which is exactly what is wanted once somebody has
        said "take a photo". The bare one is the other answer; on this phone
        it opens the system photo picker, which is the gallery.
      */}
      <input
        ref={camera}
        id={`${id}-camera`}
        type="file"
        accept={ACCEPTED}
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared, so choosing the SAME file twice still fires a change.
          event.target.value = ''
          accept(file)
        }}
      />
      <input
        ref={gallery}
        id={`${id}-gallery`}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          accept(file)
        }}
      />

      {/*
        ASKED WHERE THE CONTROL IS, but drawn outside every row.

        It is two words and two taps' worth of decision, so a full-screen
        sheet for it would be the machinery Rule #1 keeps out — but it cannot
        live INSIDE the row either: every row is `glass`, `backdrop-filter`
        makes each one a stacking context, and on the phone the menu came out
        as a white sliver trapped under the card below. A portal to the body
        is the only place above all of them.
      */}
      {asking !== null &&
        createPortal(
          <>
            {/*
              A WAY OUT. A menu with two answers and no third is a trap on a
              phone, where there is no Escape key to reach for — so the whole
              screen behind it dismisses, which is what everybody tries.
            */}
            <button
              type="button"
              aria-label={strings.photo.closeChoices}
              onClick={() => setAsking(null)}
              className="fixed inset-0 z-[70] cursor-default"
            />
            <span
              style={{ top: asking.top, right: asking.right }}
              className="fixed z-[71] flex w-max flex-col overflow-hidden rounded-xl border border-edge/10 bg-surface shadow-lg"
            >
              <button
                type="button"
                onClick={() => camera.current?.click()}
                className="flex min-h-tap items-center gap-2 px-3 text-start text-xs font-medium"
              >
                <Icon name="camera" size={0.8} />
                {strings.photo.takeNow}
              </button>
              <button
                type="button"
                onClick={() => gallery.current?.click()}
                className="flex min-h-tap items-center gap-2 border-t border-edge/10 px-3 text-start text-xs font-medium"
              >
                <Icon name="photo" size={0.8} />
                {strings.photo.chooseExisting}
              </button>
            </span>
          </>,
          document.body,
        )}

      {currentUrl === undefined ? (
        <button
          type="button"
          disabled={busy}
          onClick={pick}
          aria-expanded={asking !== null}
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
            aria-expanded={asking !== null}
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
