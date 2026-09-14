/**
 * The database key (§P, Rule #6, §Q Phase 4).
 *
 * One rule carries almost all the weight here: a missing key over an EXISTING
 * database is refused, never replaced. Minting a fresh passphrase in that
 * situation produces an app that starts, looks completely empty, and has
 * silently orphaned every invoice the owner ever wrote — the worst possible
 * failure, because it presents as a clean install rather than as an error.
 */

import { describe, expect, it } from 'vitest'

import { KEY_NAME, KeyError, type SecureStore, databaseKey, mintKey } from './key'

const store = (seed: Record<string, string> = {}): SecureStore & { held: Map<string, string> } => {
  const held = new Map(Object.entries(seed))
  return {
    held,
    get: async (key) => held.get(key) ?? null,
    set: async (key, value) => {
      held.set(key, value)
    },
  }
}

const fixedRandom = (byte: number) => (bytes: number) => new Uint8Array(bytes).fill(byte)

describe('On a first run', () => {
  it('mints a key and keeps it in secure storage', async () => {
    const secure = store()
    const key = await databaseKey(secure, { databaseExists: false, random: fixedRandom(0xab) })

    expect(key).toBe('ab'.repeat(32))
    expect(secure.held.get(KEY_NAME)).toBe(key)
  })

  it('mints 256 bits, because SQLCipher takes a passphrase and not a password', async () => {
    const secure = store()
    const key = await databaseKey(secure, { databaseExists: false })
    expect(key).toHaveLength(64)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses to mint from a non-cryptographic source', () => {
    // A weak key that works is worse than a failure that says so.
    expect(() => mintKey(() => new Uint8Array(8))).toThrow(KeyError)
  })
})

describe('On every later run', () => {
  it('returns the key already stored, without minting another', async () => {
    const secure = store({ [KEY_NAME]: 'cd'.repeat(32) })
    const key = await databaseKey(secure, { databaseExists: true, random: fixedRandom(0x11) })
    expect(key).toBe('cd'.repeat(32))
  })

  it('is stable across calls — the same database opens with the same key', async () => {
    const secure = store()
    const first = await databaseKey(secure, { databaseExists: false })
    const second = await databaseKey(secure, { databaseExists: true })
    expect(second).toBe(first)
  })
})

describe('When the key is gone but the records are not', () => {
  it('refuses rather than minting a new one over them', async () => {
    const secure = store()
    await expect(databaseKey(secure, { databaseExists: true })).rejects.toBeInstanceOf(KeyError)
  })

  it('says so in words an owner can act on, and promises nothing was deleted', async () => {
    const secure = store()
    await expect(databaseKey(secure, { databaseExists: true })).rejects.toThrow(
      /Nothing has been deleted/,
    )
  })

  it('writes nothing while refusing', async () => {
    const secure = store()
    await expect(databaseKey(secure, { databaseExists: true })).rejects.toThrow()
    // Not even a half-written key: the next launch, with the Keystore intact,
    // must still find the ORIGINAL key.
    expect(secure.held.size).toBe(0)
  })

  it('treats an empty string as missing, not as a key', async () => {
    // A cleared-but-present entry is the shape some platforms leave behind.
    // Opening a database with "" as the passphrase would fail far from here.
    const secure = store({ [KEY_NAME]: '' })
    await expect(databaseKey(secure, { databaseExists: true })).rejects.toBeInstanceOf(KeyError)
  })
})
