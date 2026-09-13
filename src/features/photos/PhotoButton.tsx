/**
 * Taking a photo (§G, §M).
 *
 * `capture="environment"` opens the rear camera on Android and iOS, and a
 * file picker everywhere else. No plugin, no permission dance written by
 * hand, and it works in a WebView — which is why this did not have to wait
 * for Phase 4, the same way the signature pad did not.
 *
 * Two rules:
 *
 *  · **Nothing is stored until the photo has been shrunk.** A 6 MB original
 *    would sit in the outbox forever on the connection §M assumes (§M: asset
 *    uploads "resume and verify hashes" precisely because that connection is
 *    bad).
 *  · **A failure is said.** A chosen file that is not an image, or a photo
 *    the browser cannot decode, produces a message rather than a button that
 *    silently did nothing.
 */

import { useId, useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { ACCEPTED, PhotoError, shrinkImage } from './resize'

export interface PhotoButtonProps {
  /** Called with the shrunk data URL. Storing it is the caller's job. */
  readonly onPhoto: (dataUrl: string) => void | Promise<void>
  /** The photo already attached, if any — shown rather than described. */
  readonly currentUrl?: string
  readonly label?: string
}

export function PhotoButton({ onPhoto, currentUrl, label }: PhotoButtonProps) {
  const { strings } = useCompany()
  const input = useRef<HTMLInputElement | null>(null)
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACCEPTED}
        // The rear camera on a phone; a file picker on a desktop.
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Clear it, so choosing the SAME file twice still fires a change.
          event.target.value = ''
          if (file === undefined) return

          setProblem(null)
          setBusy(true)
          void shrinkImage(file)
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

      {currentUrl !== undefined && (
        <img
          src={currentUrl}
          alt={strings.photo.taken}
          className="mb-2 max-h-48 w-full rounded-xl object-cover"
        />
      )}

      <button
        type="button"
        disabled={busy}
        className="min-h-tap w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-medium disabled:opacity-40"
        onClick={() => input.current?.click()}
      >
        {label ?? (currentUrl === undefined ? strings.photo.add : strings.photo.change)}
      </button>

      {problem !== null && (
        <p
          className="mt-2 rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm font-medium text-status-warn"
          role="alert"
        >
          {problem}
        </p>
      )}
    </div>
  )
}
