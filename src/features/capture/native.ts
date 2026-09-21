/**
 * The phone's own engines, behind the ports (§N).
 *
 * Thin on purpose. Every decision worth testing — what counts as available,
 * what a refusal means, what reaches the extractor — is on the other side of
 * `port.ts` or in the review gate. What is here is the part that cannot be
 * tested without a phone: talking to the plugin, and turning its reasons back
 * into the codes the rest of the app knows.
 *
 * THE PLUGIN IS OURS, and that is not incidental. Every off-the-shelf speech
 * plugin falls back to cloud transcription, and most treat it as a feature.
 * §N does not allow it, so the enforcement lives in
 * `android/.../CapturePlugin.java` where the platform call is actually made —
 * a check up here would be a check the native side could route around.
 */

import { registerPlugin } from '@capacitor/core'

import {
  type Availability,
  type CapturePorts,
  type CaptureRefusal,
  type Captured,
  CaptureError,
  available,
  unavailable,
} from './port'

interface CapturePluginShape {
  speechAvailability(): Promise<{ ok: boolean; why?: string }>
  textAvailability(): Promise<{ ok: boolean; why?: string }>
  listen(options: { locale: string }): Promise<{ text: string; partial: boolean }>
  stop(): Promise<void>
  readText(options: { source: string }): Promise<{ text: string; partial: boolean }>
}

const Capture = registerPlugin<CapturePluginShape>('Capture')

/** Every code the native side may send. Anything else is an engine failure. */
const REFUSALS: readonly CaptureRefusal[] = [
  'not_native',
  'no_permission',
  'not_on_device',
  'no_engine',
  'cancelled',
  'nothing_captured',
  'engine_failed',
]

/**
 * A thrown plugin error, as a reason the app has words for.
 *
 * UNKNOWN BECOMES `engine_failed`, never the raw message. A message from the
 * platform is English, untranslated and frequently a stack trace — putting
 * one on screen would break Rule #4 and tell somebody nothing they can act
 * on. The original is kept as `cause` for the log.
 */
const refusalOf = (thrown: unknown): CaptureError => {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  const known = REFUSALS.find((refusal) => refusal === message)
  return new CaptureError(known ?? 'engine_failed', message)
}

const availabilityOf = (result: { ok: boolean; why?: string }): Availability => {
  if (result.ok) return available()
  const known = REFUSALS.find((refusal) => refusal === result.why)
  return unavailable(known ?? 'no_engine')
}

/**
 * Whatever came back, as a `Captured`.
 *
 * `partial` is carried rather than dropped: §N's "failure always offers
 * Continue manually with whatever was recovered" means a half-heard sentence
 * is worth more than an error, and the review screen says which it is holding.
 */
const capturedOf = (result: { text: string; partial: boolean }): Captured => ({
  text: result.text,
  partial: result.partial === true,
})

export const nativeCapturePorts = (): CapturePorts => ({
  speech: {
    availability: () =>
      Capture.speechAvailability()
        .then(availabilityOf)
        /*
         * A plugin that is not there at all is a phone that cannot do this,
         * not a crash on the screen where somebody pressed a button.
         */
        .catch(() => unavailable('no_engine')),
    listen: (options) =>
      Capture.listen(options)
        .then(capturedOf)
        .catch((thrown: unknown) => {
          throw refusalOf(thrown)
        }),
    stop: () => Capture.stop().catch(() => undefined),
  },
  text: {
    availability: () =>
      Capture.textAvailability().then(availabilityOf).catch(() => unavailable('no_engine')),
    read: (options) =>
      Capture.readText({ source: options.source })
        .then(capturedOf)
        .catch((thrown: unknown) => {
          throw refusalOf(thrown)
        }),
  },
})
