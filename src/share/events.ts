/**
 * The sharing event (§M, §E).
 *
 * §M: "A share handoff records a sharing event; it never claims recipient
 * delivery."
 *
 * The record maps onto §E's `audit_log` row — action, entity, record_id, at,
 * device — rather than a table invented for it. A share IS an action taken on
 * a document, and the audit log is append-only, which is exactly right: a
 * handoff happened, and nothing that happens later can un-happen it.
 *
 * What the record deliberately cannot say:
 *
 *  · **Who received it.** The OS sheet does not report which app was chosen,
 *    let alone which person. There is no recipient field to fill in wrongly.
 *  · **That it arrived.** `SHARE_ACTIONS` has no `delivered`. A dismissed
 *    sheet and a failed one are recorded as themselves, so "we shared it" is
 *    never inferred from an attempt.
 *
 * A delivery document's actual delivery is a different thing entirely — a
 * signature on the waybill (§P) — and is never derived from a share.
 */

import type { ShareResult } from './port'

/** Every action a share can honestly record. No `delivered`, by design. */
export const SHARE_ACTIONS = ['shared', 'share_dismissed', 'share_failed'] as const
export type ShareAction = (typeof SHARE_ACTIONS)[number]

/** §E `audit_log`: id, company_id, user_id, device_id, action, entity, record_id, at. */
export interface ShareEvent {
  readonly id: string
  readonly companyId: string
  readonly action: ShareAction
  readonly entity: 'document'
  readonly recordId: string
  readonly at: string
  readonly deviceId?: string
  readonly actorId?: string
  /** Which route the handoff took — the sheet, or the clipboard fallback. */
  readonly channel: ShareResult['channel']
}

export interface ShareEventInput {
  readonly id: string
  readonly companyId: string
  readonly documentId: string
  readonly at: string
  readonly result: ShareResult
  readonly deviceId?: string
  readonly actorId?: string
}

const ACTION_OF: Readonly<Record<ShareResult['outcome'], ShareAction | null>> = {
  handed_off: 'shared',
  dismissed: 'share_dismissed',
  failed: 'share_failed',
  // Nothing was attempted, so there is nothing to record. An unavailable
  // platform is a fact about the device, not an event in the company's log.
  unavailable: null,
}

/**
 * The event for one share attempt, or null when there is nothing to record.
 */
export function shareEventFor(input: ShareEventInput): ShareEvent | null {
  const action = ACTION_OF[input.result.outcome]
  if (action === null) return null

  return Object.freeze({
    id: input.id,
    companyId: input.companyId,
    action,
    entity: 'document' as const,
    recordId: input.documentId,
    at: input.at,
    channel: input.result.channel,
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
  })
}

/** Whether a document has ever been handed off — not whether it arrived. */
export const wasShared = (events: readonly ShareEvent[], documentId: string): boolean =>
  events.some((event) => event.recordId === documentId && event.action === 'shared')

/** How many times, for the saved document's "shared N times" line. */
export const shareCount = (events: readonly ShareEvent[], documentId: string): number =>
  events.filter((event) => event.recordId === documentId && event.action === 'shared').length

/** The most recent successful handoff, or null. */
export function lastShared(
  events: readonly ShareEvent[],
  documentId: string,
): ShareEvent | null {
  let latest: ShareEvent | null = null
  for (const event of events) {
    if (event.recordId !== documentId || event.action !== 'shared') continue
    if (latest === null || event.at > latest.at) latest = event
  }
  return latest
}
