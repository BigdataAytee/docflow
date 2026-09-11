/**
 * Account isolation on the device (§M, §Q gate: "cross-account isolation still
 * holds").
 *
 * RLS protects the server. This protects the phone: "Logout … retains the
 * encrypted account-scoped local store (locked, credentials cleared), never
 * exposes it to another account" (§M).
 *
 * So the local store is keyed by account, and opening it for a different
 * account is an error rather than a merge.
 */

export class IsolationError extends Error {}

export interface LocalStoreHandle {
  readonly accountId: string
  readonly companyId: string
  readonly locked: boolean
}

/** Opening the store for the account that owns it. */
export function openStore(
  handle: LocalStoreHandle,
  accountId: string,
): LocalStoreHandle {
  if (handle.accountId !== accountId) {
    throw new IsolationError(
      'This phone holds another account’s data. It stays encrypted and untouched; signing in creates a separate store (v6 §M).',
    )
  }
  return { ...handle, locked: false }
}

/**
 * Logging out. The store is LOCKED, not deleted — §M is explicit that deleting
 * local data is a separate, deliberate action, so a logout never silently
 * destroys work that has not uploaded.
 */
export const lockOnLogout = (handle: LocalStoreHandle): LocalStoreHandle => ({
  ...handle,
  locked: true,
})

/** A queued operation may only ever be sent for the account that made it. */
export function assertOperationBelongs(
  operationCompanyId: string,
  sessionCompanyId: string,
): void {
  if (operationCompanyId !== sessionCompanyId) {
    throw new IsolationError(
      'This change belongs to a different account and will not be uploaded from this session (v6 §M).',
    )
  }
}

/** A revoked device stops syncing at its next connection (§M). */
export const deviceMaySync = (revokedDeviceIds: ReadonlySet<string>, deviceId: string): boolean =>
  !revokedDeviceIds.has(deviceId)
