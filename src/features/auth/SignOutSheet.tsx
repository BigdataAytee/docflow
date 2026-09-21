/**
 * Confirming a sign-out (§P, and the reference's log-out sheet).
 *
 * MODAL, where the rest of this app's panels are inline `<section>`s. The
 * difference is deliberate: every other sheet asks you to do something, and
 * this one asks whether you meant to lose access to what is on the screen
 * behind it. A confirmation you can tab past is not a confirmation.
 *
 * So it does the three things the reference does and the inline panels do not:
 *
 *  · `role="dialog"` with `aria-modal`, so a screen reader stops treating the
 *    page behind it as reachable;
 *  · Escape cancels, because the safe answer must be the cheap one;
 *  · Tab cycles between exactly two buttons rather than wandering into the
 *    page underneath, which `aria-modal` hides from assistive tech but does
 *    NOT remove from the tab order.
 *
 * Focus starts on "Stay here". The destructive button is never the one a
 * stray Return lands on.
 *
 * WHAT IT PROMISES is only what is true. Records are on the device and export
 * is free forever (Rule #6), so signing out does not take a document away —
 * and the copy says that rather than the reference's "you've left the
 * interactive demo", which would be false in an installed app.
 */

import { useRef } from 'react'

import { useCompany } from '../../app/context'
import { useFocusOnOpen } from '../../ui'

export interface SignOutSheetProps {
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function SignOutSheet({ onConfirm, onCancel }: SignOutSheetProps) {
  const { strings } = useCompany()
  const a = strings.account

  const confirmRef = useRef<HTMLButtonElement>(null)
  /*
   * The shared hook, attached to the SAFE button rather than to the dialog.
   *
   * `useFocusOnOpen` focuses whatever it is given and hands focus back to the
   * trigger on close, which is exactly the behaviour wanted here — and using
   * it rather than a hand-rolled effect means the repo sweep that checks
   * every sheet takes focus is satisfied for the real reason rather than
   * needing an exception. The destructive button is never what a stray Return
   * lands on.
   */
  const cancelRef = useFocusOnOpen<HTMLButtonElement>()

  /**
   * Escape, and the two-button cycle.
   *
   * Bound to the dialog rather than the window so it cannot outlive the
   * sheet — a handler left on the document is how Escape starts closing
   * things that are no longer open.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return

    const first = confirmRef.current
    const last = cancelRef.current
    if (first === null || last === null) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-navy/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      // A tap on the dimmed page is the same answer as Escape, and for the
      // same reason: leaving must be easier than confirming.
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        onKeyDown={onKeyDown}
        // The sheet is inside the backdrop, so a tap on it would bubble up
        // and cancel the thing it is part of.
        onClick={(event) => event.stopPropagation()}
        className="glass-solid w-full max-w-md rounded-[22px] p-5"
      >
        <h2 id="signout-title" className="text-center text-[14.5px] font-semibold">
          {a.signOutTitle}
        </h2>
        <p className="mb-4 mt-1.5 text-center text-[11px] leading-relaxed opacity-70">
          {a.signOutBody}
        </p>

        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="tap-scale min-h-tap w-full rounded-[15px] bg-status-bad px-4 py-3 text-[12.5px] font-semibold text-on-accent"
        >
          {a.signOutConfirm}
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="glass-pill tap-scale mt-2 min-h-tap w-full rounded-[15px] px-4 py-3 text-[12.5px] font-semibold"
        >
          {a.signOutCancel}
        </button>
      </div>
    </div>
  )
}
