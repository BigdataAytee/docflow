/**
 * The database passphrase (§P, §Q Phase 4).
 *
 * §P: "SQLite encrypted, keys in Capacitor secure storage, no secrets in the
 * JS bundle."
 *
 * So the key is not in `capacitor.config.ts`, not in an env var, and not
 * derived from anything an attacker with the APK also has. It is 256 bits of
 * CSPRNG output minted on first run and written to platform secure storage —
 * Android's EncryptedSharedPreferences behind the Keystore, iOS's Keychain.
 *
 * **It is not tied to a biometric**, and that is a Rule #6 decision rather
 * than an oversight. Binding the key to a fingerprint means a wet thumb, a
 * cracked sensor or a re-enrolled face locks an owner out of records that are
 * already sitting on their own phone. Documents are never hostage — not to a
 * lapsed subscription, and not to a sensor either. The optional app lock (§Q
 * Phase 4, default off) gates the SCREENS; this gates the file, and the two
 * are deliberately different mechanisms.
 *
 * **A missing key is never replaced with a new one.** That is the single most
 * important line in this file. If secure storage returns nothing where a
 * database already exists, minting a fresh passphrase would produce an app
 * that opens, looks empty, and has silently orphaned every invoice the owner
 * ever wrote. Refusing is the honest answer, and it is recoverable — the same
 * device with its Keystore intact will read the key next launch.
 */

/** Where the passphrase lives. One key, named once. */
export const KEY_NAME = 'docflow.db.key'

/**
 * The slice of secure storage this needs. Injected so the rule above can be
 * tested without a device, and so iOS's Keychain and Android's
 * EncryptedSharedPreferences arrive through one shape.
 */
export interface SecureStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}

export class KeyError extends Error {}

/** 256 bits, hex-encoded. SQLCipher takes a passphrase; this is not a password. */
export function mintKey(random: (bytes: number) => Uint8Array): string {
  const bytes = random(32)
  if (bytes.length !== 32) {
    throw new KeyError('The platform returned too few random bytes for a database key.')
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const cryptoRandom = (bytes: number): Uint8Array => {
  const out = new Uint8Array(bytes)
  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    // Never fall back to Math.random for a key. A weak key that works is worse
    // than a failure that says so.
    throw new KeyError('This platform has no cryptographic random source.')
  }
  globalThis.crypto.getRandomValues(out)
  return out
}

export interface KeyOptions {
  /**
   * Whether a database file already exists.
   *
   * The whole reason this is a parameter: on a FIRST run there is nothing to
   * lose, and minting is correct. On any later run a missing key means the
   * Keystore entry is gone, and minting would abandon the owner's records
   * while showing them an empty app.
   */
  readonly databaseExists: boolean
  readonly random?: (bytes: number) => Uint8Array
}

export async function databaseKey(
  store: SecureStore,
  options: KeyOptions,
): Promise<string> {
  const existing = await store.get(KEY_NAME)
  if (existing !== null && existing !== '') return existing

  if (options.databaseExists) {
    throw new KeyError(
      'This phone has DocFlow records but the key that opens them is no longer in secure storage. ' +
        'Nothing has been deleted. Signing in on this device again will restore access; ' +
        'creating a new key here would leave the existing records unreadable.',
    )
  }

  const minted = mintKey(options.random ?? cryptoRandom)
  await store.set(KEY_NAME, minted)
  return minted
}
