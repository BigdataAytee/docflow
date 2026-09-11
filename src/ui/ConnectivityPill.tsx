/**
 * Connectivity and sync state (§G, §M).
 *
 * §G is emphatic that the indicator is "truthful … driven by real connection +
 * pending work", and §M that the wording is plain, never database jargon:
 * "Saved on this phone" / "Waiting to upload" / "Uploaded" / "Needs review".
 *
 * Crucially, ONLINE DOES NOT MEAN SYNCED. Server acknowledgement completes an
 * upload (§M), so a connected device with pending operations still reads as
 * waiting — which is why `pendingCount` is a required input and not optional.
 */

export type SyncState = 'saved_local' | 'waiting' | 'uploaded' | 'needs_review'

export interface ConnectivityProps {
  readonly online: boolean
  readonly pendingCount: number
  readonly failedCount: number
  /** Already resolved through the locale layer (§M: "in the active language"). */
  readonly labels: Readonly<Record<SyncState, string>>
}

export function syncStateOf(input: {
  online: boolean
  pendingCount: number
  failedCount: number
}): SyncState {
  if (input.failedCount > 0) return 'needs_review'
  if (input.pendingCount > 0) return input.online ? 'waiting' : 'saved_local'
  return input.online ? 'uploaded' : 'saved_local'
}

const TONE: Record<SyncState, string> = {
  saved_local: 'bg-status-info-tint text-status-info',
  waiting: 'bg-status-warn-tint text-status-warn',
  uploaded: 'bg-status-good-tint text-status-good',
  needs_review: 'bg-status-bad-tint text-status-bad',
}

export function ConnectivityPill({ online, pendingCount, failedCount, labels }: ConnectivityProps) {
  const state = syncStateOf({ online, pendingCount, failedCount })
  return (
    <span
      className={`inline-flex min-h-[24px] items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[state]}`}
      role="status"
      aria-live="polite"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels[state]}
    </span>
  )
}
