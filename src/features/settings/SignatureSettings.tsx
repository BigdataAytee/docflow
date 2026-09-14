/**
 * Settings → Default signature (§G — "Your business").
 *
 * "Signs new documents unless you draw a different one." So this panel exists
 * to make signing a once-only job: the owner draws their name here, and every
 * document after it starts already signed. A signature drawn on one document
 * stays that document's — replacing the default never reaches back into an
 * issued page, because an asset is immutable and a document holds its id.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { SignaturePad } from '../signature/SignaturePad'

export interface SignatureSettingsProps {
  /** The saved default, resolved to a picture. Absent means none saved yet. */
  readonly signatureUrl?: string
  readonly onDraw: (drawn: { svg: string; dataUrl: string }) => void
  /** Stops new documents being signed by default; the drawn one is kept. */
  readonly onRemove: () => void
  readonly error?: string
}

export function SignatureSettings({
  signatureUrl,
  onDraw,
  onRemove,
  error,
}: SignatureSettingsProps) {
  const { strings } = useCompany()
  const [drawing, setDrawing] = useState(false)

  return (
    <section className="space-y-3 px-4 pt-4" aria-label={strings.settings.defaultSignature}>
      <p className="text-xs opacity-70">{strings.settings.signatureHint}</p>

      {signatureUrl === undefined ? (
        <p className="glass rounded-2xl px-4 py-6 text-center text-sm opacity-60">
          {strings.signature.nothingDrawn}
        </p>
      ) : (
        <div className="glass flex items-center justify-center rounded-2xl p-4">
          <img
            src={signatureUrl}
            alt={strings.settings.defaultSignature}
            className="max-h-20 w-auto"
          />
        </div>
      )}

      {drawing ? (
        <SignaturePad
          onClose={() => setDrawing(false)}
          {...(error === undefined ? {} : { error })}
          onUse={(drawn) => {
            setDrawing(false)
            onDraw(drawn)
          }}
        />
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            className="raised tap-scale min-h-tap flex-1 rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white"
            onClick={() => setDrawing(true)}
          >
            {signatureUrl === undefined ? strings.signature.signHere : strings.signature.clear}
          </button>
          {signatureUrl !== undefined && (
            <button
              type="button"
              className="min-h-tap rounded-xl border border-edge/10 px-4 text-sm font-medium"
              onClick={onRemove}
            >
              {strings.common.remove}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
