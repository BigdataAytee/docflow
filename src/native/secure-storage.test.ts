/**
 * The device id is stable for the life of the install (§M, §Q Phase 4).
 *
 * §M: an offline reference is "a stable device-qualified final reference", and
 * a reference is frozen at issue and never changes. So the id this file hands
 * out is load-bearing for Rule #5, not merely for telemetry: if it can change,
 * two invoices issued by one phone can carry two different device suffixes,
 * and an owner reading their own list cannot tell which came from where.
 *
 * It lived in `localStorage` until Phase 4 with a comment saying it would move
 * here. These tests are about the property that made the move necessary.
 */

import { describe, expect, it } from 'vitest'

import { DEVICE_ID_KEY, deviceId, memorySecureStore } from './secure-storage'

describe('deviceId', () => {
  it('mints one on a first run and keeps it', async () => {
    const store = memorySecureStore()
    const id = await deviceId(store, () => 'dev_fixed')
    expect(id).toBe('dev_fixed')
    expect(await store.get(DEVICE_ID_KEY)).toBe('dev_fixed')
  })

  it('never mints a second one', async () => {
    const store = memorySecureStore()
    let mints = 0
    const mint = () => `dev_${(mints += 1)}`

    const first = await deviceId(store, mint)
    const second = await deviceId(store, mint)
    const third = await deviceId(store, mint)

    expect([second, third]).toEqual([first, first])
    // The property that matters: a second id would mean a second reference
    // suffix from one phone.
    expect(mints).toBe(1)
  })

  it('reuses what is already stored, whoever wrote it', async () => {
    const store = memorySecureStore({ [DEVICE_ID_KEY]: 'dev_fromlastinstall' })
    expect(await deviceId(store, () => 'dev_new')).toBe('dev_fromlastinstall')
  })

  it('treats an empty entry as missing rather than as an id', async () => {
    const store = memorySecureStore({ [DEVICE_ID_KEY]: '' })
    expect(await deviceId(store, () => 'dev_fresh')).toBe('dev_fresh')
  })

  it('is short enough to print on a customer-facing reference (§M)', async () => {
    const store = memorySecureStore()
    const id = await deviceId(store)
    // §M's design task: "short, prefix-consistent, explained in one line".
    expect(id.startsWith('dev_')).toBe(true)
    expect(id.length).toBeLessThanOrEqual(14)
  })
})
