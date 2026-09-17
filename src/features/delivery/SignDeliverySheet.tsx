/**
 * The one small sheet (Rule #1, §G, §P).
 *
 * "One tap plus at most one small sheet for recording a payment, signing a
 * delivery, or chasing money." So everything the act needs is here — who took
 * it, their role if they have one, and their mark — and nothing that is not
 * needed is. The line saying this cannot be changed is not a warning bolted
 * on: `delivered` is terminal and the evidence seals, so somebody about to
 * hand the phone to a stranger should know that before they do.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { SignaturePad } from '../signature/SignaturePad'
import { useFocusOnOpen } from '../../ui'

export interface SignDeliverySheetProps {
  readonly onSign: (input: {
    signerName: string
    signerRole?: string
    signature: { svg: string; dataUrl: string }
  }) => void
  readonly onClose: () => void
  readonly error?: string
  /**
   * For when the customer is NOT standing there.
   *
   * Signing in person is the common case by a long way, so it is what the
   * sheet opens on. The remote link used to be a row of its own on the saved
   * document, ahead of the pad — the rarer path taking the shorter route.
   * Absent when the document cannot be signed remotely at all.
   */
  readonly onSendLink?: () => void
}

export function SignDeliverySheet({ onSign, onClose, error, onSendLink }: SignDeliverySheetProps) {
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const s = strings.signature

  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState('')

  const named = signerName.trim() !== ''

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={s.confirmDelivery}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{s.confirmDelivery}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs opacity-70">{s.sealed}</p>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor="sign-who">
        {s.whoSigned}
      </label>
      <input
        id="sign-who"
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        value={signerName}
        onChange={(event) => setSignerName(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor="sign-role">
        {s.theirRole}
      </label>
      <input
        id="sign-role"
        className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
        placeholder={s.rolePlaceholder}
        value={signerRole}
        onChange={(event) => setSignerRole(event.target.value)}
      />

      {/*
        The pad appears once there is a name, rather than accepting a mark and
        refusing it afterwards: a signature somebody has already drawn must
        never be thrown away for a rule they were not told about. §P wants the
        name and the mark captured in one moment anyway.
      */}
      {named ? (
        <div className="mt-3">
          <SignaturePad
            onClose={onClose}
            {...(error === undefined ? {} : { error })}
            onUse={(signature) =>
              onSign({
                signerName: signerName.trim(),
                ...(signerRole.trim() === '' ? {} : { signerRole: signerRole.trim() }),
                signature,
              })
            }
          />
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2.5 text-xs opacity-70">{s.nameFirst}</p>
      )}

      {/*
        The other way, kept but subordinate: a secondary line rather than a
        row above the pad. Somebody whose customer is in front of them never
        has to read past it.
      */}
      {onSendLink !== undefined && (
        <button
          type="button"
          className="mt-3 min-h-tap w-full text-center text-xs font-medium underline opacity-70"
          onClick={onSendLink}
        >
          {s.sendLinkInstead}
        </button>
      )}
    </section>
  )
}
