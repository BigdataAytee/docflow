/**
 * The signing link, once it exists (§G, §P).
 *
 * The link used to be minted, copied and printed as a bare line of text under
 * a button. Two things were wrong with that. It never said WHAT had been made
 * — an owner saw a URL and had to infer it was a private, single-use,
 * fourteen-day link to a page showing their goods. And there was no way to
 * SEND it: copying is the fallback for when the platform has no share sheet,
 * not the way to get something to a customer on WhatsApp.
 *
 * So: Send first, Copy second, and the reference and recipient named above
 * both so the owner can see what they are about to hand over.
 *
 * WHAT IS NOT CLAIMED. If the platform has no share sheet, Send is not shown
 * — §N's rule that a capability which is not installed says so rather than
 * offering a control that does nothing. The link is always displayed in full
 * as well, because a clipboard write can be refused and an owner who cannot
 * see the link has nothing to send by any route.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { useFocusOnOpen } from '../../ui'
import { format } from '../../domain/locale/data/strings'
import type { SharePort } from '../../share/port'

export interface SigningLinkSheetProps {
  /** Already resolved through the locale layer (Rule #4). */
  readonly typeLabel: string
  readonly reference: string
  readonly recipient: string
  readonly url: string
  readonly port: SharePort
  readonly onClose: () => void
  /** Records the handoff, the same as any other share (§M). */
  readonly onSent?: () => void
}

export function SigningLinkSheet({
  typeLabel,
  reference,
  recipient,
  url,
  port,
  onClose,
  onSent,
}: SigningLinkSheetProps) {
  const { strings } = useCompany()
  const p = strings.publicLink

  // Opening this takes focus, so the name of what was just made is the first
  // thing announced rather than a URL appearing silently somewhere below.
  const panel = useFocusOnOpen<HTMLElement>()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const capability = port.capability()

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={format(p.signingLinkTitle, { label: typeLabel })}
    >
      <h2 className="text-sm font-semibold">
        {format(p.signingLinkTitle, { label: typeLabel })}
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed opacity-65">{p.signingLinkBody}</p>

      <div className="recessed mt-3 rounded-xl px-3 py-2.5">
        <p className="text-xs font-semibold tabular-nums">{reference}</p>
        <p className="mt-0.5 text-xs opacity-70">{recipient}</p>
      </div>

      {/*
        The link itself, always visible. A clipboard write can be refused by
        the platform and an owner who cannot see the link has nothing to send
        by any route at all.
      */}
      <p className="mt-2 break-all rounded-lg bg-surface/70 px-2 py-1.5 text-[11px]">{url}</p>
      <p className="mt-1 text-[11px] opacity-60">{p.copied}</p>

      {capability.sheet && (
        <button
          type="button"
          disabled={busy}
          className="raised tap-scale mt-3 min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand px-4 text-sm font-semibold text-white disabled:opacity-40"
          onClick={() => {
            setBusy(true)
            void port
              .share({ title: format(p.signingLinkTitle, { label: typeLabel }), text: url })
              .then((result) => {
                // `handed_off`, never "sent": §M records that the OS took it,
                // which is the last thing this app can actually know.
                if (result.outcome === 'handed_off') onSent?.()
              })
              .finally(() => setBusy(false))
          }}
        >
          {busy ? p.sending : p.sendLink}
        </button>
      )}

      <button
        type="button"
        className="glass-pill tap-scale mt-2 min-h-tap w-full rounded-xl px-4 text-sm font-semibold"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(url)
            .then(() => setCopied(true))
            .catch(() => undefined)
        }}
      >
        {copied ? p.copiedShort : p.copyLink}
      </button>

      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-tap w-full text-xs font-medium opacity-65"
      >
        {format(p.backTo, { label: typeLabel })}
      </button>
    </section>
  )
}
