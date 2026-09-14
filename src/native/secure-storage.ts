/**
 * Secure storage (§P, §M, §Q Phase 4).
 *
 * §P: "keys in Capacitor secure storage, no secrets in the JS bundle."
 *
 * On Android that is EncryptedSharedPreferences with a key held in the
 * hardware-backed Keystore; on iOS it is the Keychain. Two things live here
 * and nothing else ever should:
 *
 *  · the SQLCipher passphrase (`src/data/sqlite/key.ts`);
 *  · this install's device id, which §M requires to be STABLE for the life of
 *    the install because it qualifies an offline reference — `INV-0042-K3` —
 *    and a reference may never change after issue.
 *
 * The device id was in `localStorage` until now, with a comment saying Phase 4
 * would move it here. It is moved: WebView storage is clearable by the system
 * under storage pressure and by "clear cache" in Android's app settings, and
 * an owner who taps that would have started minting references under a second
 * device id while the first one's invoices were already out in the world.
 *
 * **iCloud sync is OFF for both.** `sync: false` on every call. A passphrase
 * that syncs is a passphrase on another device that has no business opening
 * this database, and a device id that syncs stops identifying a device.
 */

import type { SecureStore } from '../data/sqlite/key'

/** Re-exported so callers depend on the port, not on the plugin. */
export type { SecureStore }

/** §M: stable for the life of the install. */
export const DEVICE_ID_KEY = 'docflow.deviceId'

const NEVER_SYNCED = false

export function capacitorSecureStore(): SecureStore {
  return {
    async get(key) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
      // `getItem` rather than `get`: it is the string-in, string-or-null-out
      // form, with no JSON parsing to mangle a hex passphrase.
      return SecureStorage.getItem(key)
    },
    async set(key, value) {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage')
      await SecureStorage.set(key, value, false, NEVER_SYNCED)
    },
  }
}

/**
 * A store for platforms with no secure storage — the web build and tests.
 *
 * It is NOT a fallback the device can reach: `openLocalStore` picks the
 * Capacitor store on a native platform and never this one. Anything held here
 * lives for the tab, and that is deliberate — a "secure" store backed by
 * `localStorage` would be a place to put a passphrase and believe it was safe.
 */
export function memorySecureStore(seed: Record<string, string> = {}): SecureStore {
  const held = new Map(Object.entries(seed))
  return {
    get: async (key) => held.get(key) ?? null,
    set: async (key, value) => {
      held.set(key, value)
    },
  }
}

/**
 * This install's device id (§M).
 *
 * Minted once, then never again. `mint` is injected so a test can assert that
 * a second call does not produce a second id — which is the whole property, and
 * the one an issued reference depends on.
 */
export async function deviceId(
  store: SecureStore,
  mint: () => string = defaultMint,
): Promise<string> {
  const existing = await store.get(DEVICE_ID_KEY)
  if (existing !== null && existing !== '') return existing

  const minted = mint()
  await store.set(DEVICE_ID_KEY, minted)
  return minted
}

const defaultMint = (): string => {
  // Short, because §M asks the device-qualified reference to be
  // "customer-presentable — short, prefix-consistent". The suffix a customer
  // sees comes from this, so it is base36 and compact rather than a UUID.
  const random =
    typeof globalThis.crypto?.getRandomValues === 'function'
      ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)))
          .map((byte) => byte.toString(36))
          .join('')
      : Math.random().toString(36).slice(2, 10)
  return `dev_${random.slice(0, 10)}`
}
