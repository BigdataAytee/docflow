/**
 * Getting words off a phone without them leaving it (§N).
 *
 * Two ways in — speaking and photographing — and one rule over both: the
 * recognition happens ON THE DEVICE or it does not happen. §N is explicit
 * that there is no cloud carve-out here and no silent fallback, and this is
 * the boundary where that either holds or quietly stops holding.
 *
 * WHY A PORT AND NOT A PLUGIN CALL. The platform engines are the part that
 * cannot be tested here: Android's recogniser and ML Kit need a phone. What
 * CAN be tested is everything this project actually promises — that a refusal
 * is reported as a refusal, that an engine which can only work online is
 * treated as unavailable rather than used, that nothing reaches a draft
 * without confirmation. Those are decisions about results, so they live
 * behind an interface and the phone supplies the results.
 *
 * THE DANGEROUS CASE, named so it cannot be forgotten: Android's
 * `SpeechRecognizer` will happily transcribe by sending audio to a server,
 * and it is the DEFAULT. A phone that cannot do it on-device must report
 * `not_on_device` — never fall through, never "try online just this once".
 * §N: "an unsupported device is described as unsupported, never relabelled
 * 'needs internet'". The same sentence applies here with the sign flipped:
 * a device that would need internet is not quietly given it.
 *
 * REASONS ARE CODES, NEVER SENTENCES (Rule #4, §S). The words belong to the
 * catalogue; a port that returned "Microphone permission denied" would be a
 * port that decided what language the app speaks.
 */

/**
 * Why a capture could not happen. Each is a different thing to say to
 * somebody, which is why they are not collapsed into one failure.
 */
export type CaptureRefusal =
  /** Not a phone — a browser has no on-device engine to promise anything. */
  | 'not_native'
  /** The person said no to the microphone or the camera. */
  | 'no_permission'
  /**
   * The phone can only do this by sending audio or an image away.
   *
   * The one §N exists for. Reported rather than worked around.
   */
  | 'not_on_device'
  /** Nothing installed that can do it at all — no recogniser, no ML Kit. */
  | 'no_engine'
  /** They backed out. Not a failure, and never reported as one. */
  | 'cancelled'
  /** It ran and heard or saw nothing usable. */
  | 'nothing_captured'
  /** The engine itself failed. The only case that carries a cause. */
  | 'engine_failed'

export class CaptureError extends Error {
  constructor(
    readonly refusal: CaptureRefusal,
    /** For the log, never for the screen — the words are the catalogue's. */
    override readonly cause?: string,
  ) {
    super(refusal)
    this.name = 'CaptureError'
  }
}

/** Whether a capture route can run at all, asked before anything is offered. */
export type Availability = { readonly ok: true } | { readonly ok: false; readonly why: CaptureRefusal }

export const available = (): Availability => ({ ok: true })
export const unavailable = (why: CaptureRefusal): Availability => ({ ok: false, why })

/**
 * What came back from the phone.
 *
 * TEXT ONLY, and that is structural. §N: "pasted and OCR text is data, never
 * instructions" — nothing downstream of this can be steered by what was said
 * or photographed, because the only thing that crosses this boundary is a
 * string that goes into the deterministic extractor. There is no model here
 * with a prompt to poison.
 */
export interface Captured {
  readonly text: string
  /**
   * Whether the words came back complete or the engine gave up part-way.
   *
   * §N's "failure always offers Continue manually WITH WHATEVER WAS
   * RECOVERED": a half-heard sentence is worth more than an error, so a
   * partial result is returned rather than thrown away.
   */
  readonly partial: boolean
}

/** Speaking. */
export interface SpeechPort {
  /**
   * ON-DEVICE ONLY, checked rather than hoped for.
   *
   * Asked before the button is offered, so a phone that cannot do this shows
   * a plain explanation instead of a control that fails when pressed — §N's
   * "never a dead button".
   */
  availability(): Promise<Availability>
  /** Listens once. Rejects with `CaptureError`; never resolves to an error. */
  listen(options: { readonly locale: string }): Promise<Captured>
  /** Stops an in-flight listen. Safe to call when nothing is listening. */
  stop(): Promise<void>
}

/** Photographing. */
export interface TextRecognitionPort {
  availability(): Promise<Availability>
  /**
   * Reads text out of one image.
   *
   * `source` is asked EXPLICITLY rather than left to the platform: the
   * per-item photo walk found that a bare file input opens the gallery on
   * this phone and the camera on others, so a trader who had photographed
   * the invoice that morning could not reach the shot. The same mistake is
   * not worth making twice.
   */
  read(options: { readonly source: 'camera' | 'gallery' }): Promise<Captured>
}

export interface CapturePorts {
  readonly speech: SpeechPort
  readonly text: TextRecognitionPort
}

/**
 * The ports a browser gets.
 *
 * Not an error and not a stub that pretends: a browser genuinely has no
 * on-device engine this app is willing to use, so it says so and the buttons
 * explain themselves. `npm run dev` stays usable and nothing silently
 * reaches for the network to make a demo look better.
 */
export const unavailablePorts = (why: CaptureRefusal = 'not_native'): CapturePorts => ({
  speech: {
    availability: () => Promise.resolve(unavailable(why)),
    listen: () => Promise.reject(new CaptureError(why)),
    stop: () => Promise.resolve(),
  },
  text: {
    availability: () => Promise.resolve(unavailable(why)),
    read: () => Promise.reject(new CaptureError(why)),
  },
})
