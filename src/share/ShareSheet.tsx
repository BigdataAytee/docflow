/**
 * The share sheet (§B, §G, §M).
 *
 * Everything §M's one sentence implies, on screen:
 *
 *  · It shows WHAT GOES OUT before anything goes out. §L1 established the
 *    rule for reminders — "nothing sent unseen" — and it holds here too.
 *  · After a handoff it says the document was handed to the app you picked,
 *    and says plainly that DocFlow cannot tell whether it arrived. Every other
 *    app in this category says "Sent!"; that is the lie this one does not tell.
 *  · A platform that cannot open a sheet says so and offers the clipboard. A
 *    platform that can do neither says that. No button here opens nothing (§N).
 *  · Until §Q Phase 4's native PDF writer exists there is no file to attach,
 *    and the sheet says the text goes out on its own rather than implying a
 *    PDF is riding along.
 */

import { useState } from 'react'

import { useCompany } from '../app/context'
import { format } from '../domain/locale/data/strings'
import type { ShareResult, SharePort } from './port'
import type { ShareText } from './text'
import { useFocusOnOpen } from '../ui'

export interface ShareSheetProps {
  readonly port: SharePort
  readonly text: ShareText
  /** Present once there is a rendered document to attach (Phase 4). */
  readonly fileName?: string
  readonly onResult: (result: ShareResult) => void
  readonly onClose: () => void
  readonly sharedCount?: number
  readonly lastSharedAt?: string
}

export function ShareSheet({
  port,
  text,
  fileName,
  onResult,
  onClose,
  sharedCount = 0,
  lastSharedAt,
}: ShareSheetProps) {
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const s = strings.share

  const [result, setResult] = useState<ShareResult | null>(null)
  const [busy, setBusy] = useState(false)

  const can = port.capability()

  const run = () => {
    if (busy) return
    setBusy(true)
    void port
      .share({ title: text.title, text: text.body })
      .then((outcome) => {
        setResult(outcome)
        onResult(outcome)
      })
      .finally(() => setBusy(false))
  }

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass-solid rounded-2xl p-4 outline-none"
      aria-label={s.title}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">{s.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.common.cancel}
          className="min-h-tap min-w-tap text-lg leading-none opacity-60"
        >
          ✕
        </button>
      </div>

      {/* Nothing sent unseen: the exact text, before it goes anywhere. */}
      <p className="mt-3 text-xs font-medium opacity-70">{s.preview}</p>
      <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-ink/[0.04] p-3 text-xs">
        {text.body}
      </pre>

      {fileName === undefined && (
        <p className="mt-2 text-[11px] opacity-60">{s.fileComingWithApp}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {can.sheet && (
          <button
            type="button"
            className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand text-sm font-semibold text-white disabled:opacity-40"
            disabled={busy}
            onClick={run}
          >
            {s.openSheet}
          </button>
        )}

        {/* Offered on its own only when there is no sheet to open — otherwise
            the sheet already falls back to it. */}
        {!can.sheet && can.clipboard && (
          <button
            type="button"
            className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand text-sm font-semibold text-white disabled:opacity-40"
            disabled={busy}
            onClick={run}
          >
            {s.copyInstead}
          </button>
        )}

        {!can.sheet && !can.clipboard && (
          <p className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-xs font-medium text-status-warn">
            {s.unavailable}
          </p>
        )}
      </div>

      {result !== null && (
        <div className="mt-3" role="status">
          <p className="text-sm font-medium">{sentenceFor(result, s)}</p>
          {result.outcome === 'handed_off' && (
            <p className="mt-1 text-[11px] opacity-70">{s.neverClaimsDelivery}</p>
          )}
        </div>
      )}

      {sharedCount > 0 && (
        <p className="mt-3 text-[11px] opacity-60">
          {sharedCount === 1 ? s.sharedOnce : format(s.sharedTimes, { count: sharedCount })}
          {lastSharedAt !== undefined && ` · ${format(s.lastSharedOn, { date: lastSharedAt })}`}
        </p>
      )}
    </section>
  )
}

function sentenceFor(result: ShareResult, s: ReturnType<typeof useCompany>['strings']['share']): string {
  switch (result.outcome) {
    case 'handed_off':
      return result.channel === 'clipboard' ? s.copied : s.handedOff
    case 'dismissed':
      return s.dismissed
    case 'failed':
      return s.failed
    case 'unavailable':
      return s.unavailable
  }
}
