/**
 * What happens when somebody taps "Export all my data".
 *
 * The button has existed since Phase 2 with the Rule #6 sentence under it, and
 * it called nothing. This is the other end of it.
 *
 * It goes out through the SHARE port — the same one a PDF uses — for two
 * reasons. It works in airplane mode, which §M requires of "local
 * share/export", and it means Phase 4's Capacitor adapter carries the export
 * to a phone's own file picker without this file changing. Inventing a
 * download here would have been a web-only answer to a mobile-first product.
 */

import type { SharePort } from '../../share/port'
import type { Repositories } from '../../data/repositories/types'
import { type ExportResult, archiveFilename, archiveJson, exportArchive } from './archive'

export type ExportOutcome =
  | { readonly kind: 'shared'; readonly result: ExportResult; readonly filename: string }
  | { readonly kind: 'copied'; readonly result: ExportResult; readonly filename: string }
  | { readonly kind: 'incomplete'; readonly result: ExportResult }
  | { readonly kind: 'unavailable'; readonly result: ExportResult }
  | { readonly kind: 'failed'; readonly result: ExportResult; readonly reason: string }

const encoder = new TextEncoder()

export async function runExport(
  repositories: Repositories,
  companyId: string,
  share: SharePort,
  now?: () => Date,
): Promise<ExportOutcome> {
  const result = await exportArchive(repositories, companyId, now)

  // An incomplete archive is never handed over. The owner would keep it,
  // believe it whole, and find out when it is the only copy left.
  if (!result.complete) return { kind: 'incomplete', result }

  const json = archiveJson(result.archive)
  const filename = archiveFilename(result.archive)
  const capability = share.capability()

  if (!capability.sheet && !capability.clipboard) return { kind: 'unavailable', result }

  const outcome = await share.share({
    // Not a document type name — this is the account, so Rule #4 does not
    // reach it and there is nothing to resolve through the locale layer.
    title: filename,
    text: json,
    ...(capability.files
      ? {
          file: {
            name: filename,
            mimeType: 'application/json',
            bytes: encoder.encode(json),
          },
        }
      : {}),
  })

  switch (outcome.outcome) {
    case 'handed_off':
      return {
        kind: outcome.channel === 'clipboard' ? 'copied' : 'shared',
        result,
        filename,
      }
    case 'unavailable':
      return { kind: 'unavailable', result }
    case 'dismissed':
      // The person changed their mind. Not a failure, and not a success
      // either — saying "Exported" here would be a lie about a file that does
      // not exist.
      return { kind: 'failed', result, reason: 'dismissed' }
    case 'failed':
      return { kind: 'failed', result, reason: outcome.reason ?? 'the share failed' }
  }
}
