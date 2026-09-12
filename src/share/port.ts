/**
 * The share port (§B, §G, §M).
 *
 * §B: "send documents as PDFs over WhatsApp or the native share sheet."
 * §M: "A share handoff records a sharing event; it never claims recipient
 * delivery."
 *
 * That second sentence is the whole shape of this file. Handing a document to
 * another app is the last thing DocFlow knows about it: the OS sheet does not
 * report which app was picked, whether the message was sent, or whether anyone
 * read it. So `ShareOutcome` has no `delivered`, no `sent` and no `received` —
 * not because the UI chooses not to show them, but because there is no value
 * that could carry them. A field that cannot exist cannot be believed.
 *
 * The port is an interface because the platform underneath changes and the
 * screens above must not: the web build uses the Web Share API (below), Phase 4
 * swaps in Capacitor's Share plugin, and neither is visible to a screen.
 *
 * Capability is DECLARED, never guessed. §N's rule — an unavailable capability
 * is stated plainly rather than dressed up — applies to a share button as much
 * as to a language model: a button that opens nothing is worse than one that
 * is not there.
 */

export interface SharePayload {
  /** Already resolved through the locale layer (Rule #5, §D.2). */
  readonly title: string
  readonly text: string
  /**
   * The rendered document, when the platform can produce one. Absent until
   * §Q Phase 4's native PDF writer exists — the text still goes out, and the
   * sheet says so rather than pretending a file is attached.
   */
  readonly file?: SharedFile
}

export interface SharedFile {
  readonly name: string
  readonly mimeType: string
  readonly bytes: Uint8Array
}

/** What this platform can actually do, right now, on this device. */
export interface ShareCapability {
  /** The OS sheet is reachable. */
  readonly sheet: boolean
  /** The sheet will accept a file, not only text. */
  readonly files: boolean
  /** Copying to the clipboard is possible, as the fallback when no sheet is. */
  readonly clipboard: boolean
}

export const NO_CAPABILITY: ShareCapability = { sheet: false, files: false, clipboard: false }

/**
 * How a share ended, as far as this device can honestly know.
 *
 * `handed_off` means the OS took it. It does NOT mean a person received it.
 */
export type ShareOutcome = 'handed_off' | 'dismissed' | 'unavailable' | 'failed'

export interface ShareResult {
  readonly outcome: ShareOutcome
  /** Which route was used, for the sharing event. */
  readonly channel: 'sheet' | 'clipboard' | 'none'
  /** Present on `failed`, for the actionable per-record error §M asks for. */
  readonly reason?: string
}

export interface SharePort {
  capability(): ShareCapability
  share(payload: SharePayload): Promise<ShareResult>
}

/**
 * A port that can do nothing, and says so. Used where no platform has been
 * wired yet, so the absence is explicit rather than a crash or a silent no-op.
 */
export const unavailableSharePort: SharePort = {
  capability: () => NO_CAPABILITY,
  share: async () => ({ outcome: 'unavailable', channel: 'none' }),
}
