/**
 * The native share sheet (§B, §M, §Q Phase 4).
 *
 * The same `SharePort` the web adapter implements, so no screen changes — the
 * comment in `src/share/web.ts` has promised this swap since Phase 2 and this
 * is it.
 *
 * Two things are different on a phone, and both are the reason Phase 4 exists.
 *
 * **A file can actually go out.** The Web Share API takes a `File` object;
 * Android's share sheet takes a URI, and an app can only grant another app
 * access to a URI it owns. So a PDF is written to the app's cache directory
 * first and shared from there through the FileProvider declared in the
 * manifest. `Cache`, not `Documents`: a shared invoice is a copy in flight,
 * the owner's copy is the record in SQLite, and letting the OS reclaim the
 * cache is correct rather than a leak.
 *
 * **Capability is still declared, never guessed** (§N). `canShare` tells us
 * whether the sheet exists at all. A button that opens nothing is worse than
 * one that is not there — that rule is the same on both platforms, and so the
 * shape of the answer is the same.
 *
 * What has NOT changed is the thing §M insists on: the sheet does not report
 * which app was chosen or whether anything arrived, so `ShareOutcome` still
 * has no `delivered`. `handed_off` means the OS took it, and nothing more.
 */

import {
  type SharePayload,
  type ShareCapability,
  type SharePort,
  type ShareResult,
  type SharedFile,
} from '../share/port'

/** Where a shared file is staged. Cache, so the OS may reclaim it. */
const STAGING_DIRECTORY = 'Cache'

export function createNativeSharePort(): SharePort {
  // Probed once at construction: the answer cannot change while the app runs,
  // and a capability check that awaits cannot be read by a render.
  let capability: ShareCapability = { sheet: true, files: true, clipboard: false }

  void (async () => {
    try {
      const { Share } = await import('@capacitor/share')
      const { value } = await Share.canShare()
      capability = { sheet: value, files: value, clipboard: false }
    } catch {
      capability = { sheet: false, files: false, clipboard: false }
    }
  })()

  return {
    capability: () => capability,

    async share(payload: SharePayload): Promise<ShareResult> {
      if (!capability.sheet) return { outcome: 'unavailable', channel: 'none' }

      try {
        const { Share } = await import('@capacitor/share')
        const url = payload.file === undefined ? undefined : await stage(payload.file)

        await Share.share({
          title: payload.title,
          text: payload.text,
          // `dialogTitle` is Android's chooser heading. Already resolved
          // through the locale layer by the caller (Rule #4).
          dialogTitle: payload.title,
          ...(url === undefined ? {} : { files: [url] }),
        })

        // The OS took it. That is all this means (§M).
        return { outcome: 'handed_off', channel: 'sheet' }
      } catch (cause) {
        // Android reports a dismissed chooser as an error, and it is not one:
        // the owner looked at the sheet and changed their mind. Recording that
        // as `failed` would put a red event in the log for a normal action.
        if (isDismissal(cause)) return { outcome: 'dismissed', channel: 'sheet' }
        return { outcome: 'failed', channel: 'sheet', reason: messageOf(cause) }
      }
    },
  }
}

/**
 * Write the bytes somewhere the OS can hand to another app, and return the URI.
 *
 * Base64 rather than a Blob because the Capacitor bridge is JSON: bytes cross
 * it as a string whatever we do, and doing it explicitly keeps the encoding in
 * one place instead of inside a plugin's assumptions.
 */
async function stage(file: SharedFile): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')

  await Filesystem.writeFile({
    path: file.name,
    data: toBase64(file.bytes),
    directory: Directory[STAGING_DIRECTORY],
  })

  const { uri } = await Filesystem.getUri({
    path: file.name,
    directory: Directory[STAGING_DIRECTORY],
  })
  return uri
}

/**
 * Bytes to base64, in chunks.
 *
 * `String.fromCharCode(...bytes)` on a whole PDF blows the argument limit and
 * throws — on a big invoice, on a cheap phone, at the moment somebody tries to
 * send it. 8KB at a time is well under every engine's limit.
 */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 8192
  let binary = ''
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK))
  }
  return btoa(binary)
}

const DISMISSAL = /cancel|abort|dismiss/i

const isDismissal = (cause: unknown): boolean =>
  cause instanceof Error && DISMISSAL.test(cause.message)

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)
