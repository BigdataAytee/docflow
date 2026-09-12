/**
 * The Web Share API adapter (§C — the web build; the dev server too).
 *
 * Three routes, tried in order, each reported as a capability before it is
 * offered: the OS sheet with a file, the OS sheet with text, the clipboard.
 * A platform with none of them reports none, and the sheet UI shows that
 * rather than a button that opens nothing (§N).
 *
 * Everything here is local. Sharing a document never touches the network, so
 * it works in airplane mode, which §M requires of "local share/export".
 *
 * Phase 4 replaces this with Capacitor's Share plugin behind the same port;
 * no screen changes.
 */

import {
  type SharePayload,
  type ShareCapability,
  type SharePort,
  type ShareResult,
  NO_CAPABILITY,
} from './port'

/** The slice of the platform this adapter needs. Injected, so it is testable. */
export interface ShareEnvironment {
  readonly share?: (data: ShareData) => Promise<void>
  readonly canShare?: (data: ShareData) => boolean
  readonly writeText?: (text: string) => Promise<void>
  readonly file?: (bytes: Uint8Array, name: string, mimeType: string) => File
}

/** Reads the real browser, defensively — any of these may be absent. */
export function browserEnvironment(): ShareEnvironment {
  const nav: Navigator | undefined = globalThis.navigator
  const environment: ShareEnvironment = {
    ...(typeof nav?.share === 'function' ? { share: nav.share.bind(nav) } : {}),
    ...(typeof nav?.canShare === 'function' ? { canShare: nav.canShare.bind(nav) } : {}),
    ...(typeof nav?.clipboard?.writeText === 'function'
      ? { writeText: nav.clipboard.writeText.bind(nav.clipboard) }
      : {}),
    ...(typeof File === 'function'
      ? {
          file: (bytes, name, mimeType) =>
            // A fresh buffer, so the caller's bytes are never retained by the
            // platform after the share — and never mutated under it.
            new File([new Uint8Array(bytes)], name, { type: mimeType }),
        }
      : {}),
  }
  return environment
}

export function createWebSharePort(
  environment: ShareEnvironment = browserEnvironment(),
): SharePort {
  const capability = (): ShareCapability => {
    const sheet = typeof environment.share === 'function'
    const clipboard = typeof environment.writeText === 'function'
    if (!sheet && !clipboard) return NO_CAPABILITY

    // `canShare` is the only honest way to know whether files are accepted;
    // without it, assume not, because a rejected file loses the whole share.
    const files =
      sheet &&
      typeof environment.canShare === 'function' &&
      typeof environment.file === 'function' &&
      environment.canShare({ files: [environment.file(new Uint8Array(1), 'probe.pdf', 'application/pdf')] })

    return { sheet, files, clipboard }
  }

  return {
    capability,

    async share(payload: SharePayload): Promise<ShareResult> {
      const can = capability()

      if (can.sheet && environment.share !== undefined) {
        const data: ShareData = { title: payload.title, text: payload.text }
        if (can.files && payload.file !== undefined && environment.file !== undefined) {
          data.files = [
            environment.file(payload.file.bytes, payload.file.name, payload.file.mimeType),
          ]
        }
        try {
          await environment.share(data)
          // The OS took it. That is all this means (§M).
          return { outcome: 'handed_off', channel: 'sheet' }
        } catch (cause) {
          // A dismissed sheet rejects with AbortError, which is not a failure:
          // the owner looked at it and changed their mind.
          if (isAbort(cause)) return { outcome: 'dismissed', channel: 'sheet' }
          // Fall through to the clipboard rather than losing the document.
          if (!can.clipboard) {
            return { outcome: 'failed', channel: 'sheet', reason: messageOf(cause) }
          }
        }
      }

      if (can.clipboard && environment.writeText !== undefined) {
        try {
          await environment.writeText(payload.text)
          return { outcome: 'handed_off', channel: 'clipboard' }
        } catch (cause) {
          return { outcome: 'failed', channel: 'clipboard', reason: messageOf(cause) }
        }
      }

      return { outcome: 'unavailable', channel: 'none' }
    },
  }
}

/**
 * Only AbortError. A dismissed sheet means the owner looked and changed their
 * mind; NotAllowedError means the platform refused, which they need told about
 * — collapsing the two would hide a real failure behind "you cancelled".
 */
const isAbort = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === 'AbortError'

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
