/**
 * This install's device id (§M).
 *
 * It qualifies an offline reference (`INV-0042-K3`) and stamps every operation
 * in the outbox, so it must be STABLE for the life of the install — a
 * reference must never change after issue. Phase 4 moves this into secure
 * storage alongside the encrypted database; until then it lives in
 * `localStorage`, and a browser that refuses it gets a per-session id rather
 * than a crash.
 */

const KEY = 'docflow.deviceId'

let inMemory: string | null = null

const mint = (): string =>
  `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

export function deviceId(): string {
  if (inMemory !== null) return inMemory

  try {
    const stored = globalThis.localStorage?.getItem(KEY)
    if (stored !== null && stored !== undefined && stored !== '') {
      inMemory = stored
      return stored
    }
    const minted = mint()
    globalThis.localStorage?.setItem(KEY, minted)
    inMemory = minted
    return minted
  } catch {
    // Private browsing, blocked site data, a test environment without storage.
    inMemory = mint()
    return inMemory
  }
}
