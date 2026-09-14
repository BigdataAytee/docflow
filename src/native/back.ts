/**
 * The Android back button (§Q Phase 4, §G).
 *
 * Capacitor's default is to close the app whenever the WebView has no history
 * entry to pop. In a single-page app with a router that is wrong roughly half
 * the time, and it is wrong in the expensive direction: an owner three fields
 * into a builder taps back expecting to leave the sheet, and the app exits.
 *
 * The rule here is the one Android users already have in their hands:
 *
 *  1. If something is layered over the page — a sheet, a dialog, the palette —
 *     back closes the top layer. Nothing else moves.
 *  2. Otherwise, if there is somewhere to go back to, go there.
 *  3. Otherwise, on Home, back exits — but only on the SECOND press within two
 *     seconds, with a toast in between saying so.
 *
 * Rule 3 is not decoration. Losing an unsaved draft to a misplaced thumb is
 * exactly the kind of thing that makes an app feel unsafe to type into, and
 * §G's whole builder assumes people type into it freely.
 *
 * Layers register themselves rather than being enumerated here, so a sheet
 * added later is handled without this file knowing it exists.
 */

export interface BackHandlers {
  /** Closes the topmost layer if there is one. Returns whether it did. */
  readonly closeTopLayer: () => boolean
  /** Whether the router can go back within the app. */
  readonly canGoBack: () => boolean
  readonly goBack: () => void
  /** Shown before the app will exit, in the active language. */
  readonly warn: (message: string) => void
  readonly exit: () => void
}

/** How long the second press counts as confirming the first. */
export const CONFIRM_WINDOW_MS = 2_000

export interface BackDecision {
  readonly action: 'closed_layer' | 'went_back' | 'warned' | 'exited'
}

/**
 * The decision, as a pure function, so it is tested without a device and
 * without a router.
 */
export function decideBack(
  handlers: BackHandlers,
  state: { lastPressAt: number | null },
  now: number,
  exitMessage: string,
): BackDecision {
  if (handlers.closeTopLayer()) {
    // A layer closing resets the exit intent: the owner was dismissing
    // something, not asking to leave.
    state.lastPressAt = null
    return { action: 'closed_layer' }
  }

  if (handlers.canGoBack()) {
    handlers.goBack()
    state.lastPressAt = null
    return { action: 'went_back' }
  }

  if (state.lastPressAt !== null && now - state.lastPressAt <= CONFIRM_WINDOW_MS) {
    handlers.exit()
    return { action: 'exited' }
  }

  state.lastPressAt = now
  handlers.warn(exitMessage)
  return { action: 'warned' }
}

/**
 * Wires the decision to the real button.
 *
 * Returns the unsubscribe, because a listener that outlives its handlers holds
 * a closed router and swallows every press.
 */
export async function wireBackButton(
  handlers: BackHandlers,
  exitMessage: string,
): Promise<() => void> {
  const { App } = await import('@capacitor/app')
  const state: { lastPressAt: number | null } = { lastPressAt: null }

  const listener = await App.addListener('backButton', () => {
    decideBack(handlers, state, Date.now(), exitMessage)
  })

  return () => {
    void listener.remove()
  }
}
