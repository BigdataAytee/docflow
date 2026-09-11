/**
 * The sync chaos suite (§Q Phase 3).
 *
 * "Force-kill mid-drain, duplicate replay, two-device concurrent edits, clock
 * skew, offline issue → online reconcile, region change racing a sync."
 *
 * The gate: "five documents created offline arrive once with unique final
 * references despite a mid-sync kill and retry; two-device same-field edits
 * retain both versions; no chaos scenario double-counts money, resurrects a
 * deletion, or alters a frozen label; cross-account isolation still holds."
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { money } from '../domain/money/money'
import { applyPaymentEvents, effectivePayments, type Payment } from '../domain/payments/ledger'
import { freezeLabels } from '../domain/locale/profile'
import { composeDocument } from '../pdf/compose'
import { type Operation } from './operations'
import { Outbox, type SendOutcome, drain } from './outbox'
import { resolve, type RecordVersion } from './conflicts'
import { applyPull, PullError, type LocalStore } from './pull'
import { takeNumber, assertNoOverlap, NumberingError, type Reservation } from './numbering'
import { verifyUpload, type Asset } from './assets'

const NGN = (m: number) => money('NGN', m)
const NOW = '2026-09-11T12:00:00Z'

const operation = (id: string, over: Partial<Operation> = {}): Operation => ({
  id,
  entity: 'document',
  recordId: `rec-${id}`,
  kind: 'create',
  payload: {},
  idempotencyKey: `key-${id}`,
  baseVersion: 0,
  actorId: 'user-1',
  deviceId: 'device-a',
  createdAt: NOW,
  ...over,
})

/** A server that records what it received, keyed by idempotency key. */
function fakeServer() {
  const received = new Map<string, Operation>()
  return {
    received,
    send: async (op: Operation): Promise<SendOutcome> => {
      if (received.has(op.idempotencyKey)) return { ok: true, duplicate: true }
      received.set(op.idempotencyKey, op)
      return { ok: true }
    },
  }
}

describe('Chaos 1 — force-kill mid-drain (§Q gate)', () => {
  it('five offline documents arrive exactly once despite a kill and retry', async () => {
    const server = fakeServer()
    const outbox = new Outbox()

    for (let i = 0; i < 5; i++) {
      outbox.commit({ write: () => ({ id: `doc-${i}` }), operation: operation(`op-${i}`) })
    }

    // The app dies after two operations land.
    let delivered = 0
    const dyingSend = async (op: Operation): Promise<SendOutcome> => {
      if (delivered >= 2) throw new Error('process killed')
      delivered += 1
      return server.send(op)
    }
    await drain(outbox, dyingSend, NOW)

    // It restarts, restoring the queue from storage, and drains again.
    const restored = Outbox.restore(outbox.all())
    await drain(restored, server.send, '2026-09-11T12:30:00Z')

    expect(server.received.size).toBe(5)
    expect(restored.pending()).toHaveLength(0)
  })

  it('puts an in-flight operation back to pending after a restart', () => {
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('op-1') })
    outbox.markInFlight('op-1')

    // The server may or may not have applied it; the key makes resending safe.
    const restored = Outbox.restore(outbox.all())
    expect(restored.ready(NOW).map((e) => e.operation.id)).toEqual(['op-1'])
  })

  it('never reports uploaded on a thrown sender — the operation stays owed', async () => {
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('op-1') })

    await drain(outbox, async () => {
      throw new Error('connection reset')
    }, NOW)

    expect(outbox.pending()).toHaveLength(1)
    expect(outbox.failed()[0]?.lastError).toContain('connection reset')
  })

  it('rolls the outbox entry back when the record write fails (§C)', () => {
    const outbox = new Outbox()
    expect(() =>
      outbox.commit({
        write: () => {
          throw new Error('disk full')
        },
        operation: operation('op-1'),
      }),
    ).toThrow('disk full')

    // Neither half happened: nothing queued, so nothing will claim "Saved".
    expect(outbox.all()).toHaveLength(0)
  })
})

describe('Chaos 2 — duplicate replay (§Q gate)', () => {
  it('a replayed drain uploads nothing twice', async () => {
    const server = fakeServer()
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('op-1') })

    await drain(outbox, server.send, NOW)
    await drain(outbox, server.send, NOW)
    await drain(outbox, server.send, NOW)

    expect(server.received.size).toBe(1)
  })

  it('refuses to queue the same idempotency key twice', () => {
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('op-1') })
    expect(() =>
      outbox.commit({ write: () => ({}), operation: operation('op-2', { idempotencyKey: 'key-op-1' }) }),
    ).toThrow()
  })

  it('never double-counts money under any replay pattern', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 3 }), { minLength: 1, maxLength: 20 }), (replays) => {
        const payment: Payment = {
          id: 'p1',
          customerId: 'c1',
          amount: NGN(50_000_00),
          paidAt: NOW,
          method: 'bank_transfer',
          source: 'provider',
          externalEventId: 'evt_1',
          allocations: [],
        }
        // The same event arriving any number of times, in any order.
        const stream = replays.map(() => payment)
        const ledger = applyPaymentEvents(stream)
        const total = effectivePayments(ledger).reduce((sum, p) => sum + p.amount.minor, 0)
        expect(total).toBe(50_000_00)
      }),
    )
  })
})

describe('Chaos 3 — two-device concurrent edits (§Q gate)', () => {
  const current: RecordVersion = {
    version: 5,
    fields: { customerName: 'Okoro & Sons', note: 'theirs' },
    updatedBy: 'user-b',
  }

  it('merges disjoint edits to a draft without asking', () => {
    const result = resolve({
      entity: 'customer',
      current,
      incoming: { baseVersion: 4, fields: { phone: '+234800' }, actorId: 'user-a', deviceId: 'device-a' },
    })
    expect(result.kind).toBe('merged')
  })

  it('retains BOTH versions on a same-field edit (§L7, §Q gate)', () => {
    const result = resolve({
      entity: 'customer',
      current,
      incoming: { baseVersion: 4, fields: { note: 'mine' }, actorId: 'user-a', deviceId: 'device-a' },
    })
    expect(result.kind).toBe('conflict')
    if (result.kind !== 'conflict') return
    expect(result.fields).toEqual(['note'])
    expect(result.mine).toEqual({ note: 'mine' })
    expect(result.theirs).toEqual({ note: 'theirs' })
  })

  it('leaves the local record untouched until the user chooses', () => {
    const store = new Map<string, RecordVersion>()
    // This device edited `note` and has not yet uploaded it.
    store.set('customer:c1', { ...current, pendingLocalFields: { note: 'mine' } })
    const local: LocalStore = {
      get: (_e, id) => store.get(`customer:${id}`) ?? null,
      put: (_e, id, record) => void store.set(`customer:${id}`, record),
    }

    const result = applyPull(
      {
        cursor: 'c2',
        records: [
          { entity: 'customer', recordId: 'c1', version: 6, fields: { note: 'server' }, updatedBy: 'user-b' },
        ],
      },
      local,
      { transaction: (work) => work() },
    )

    expect(result.conflicts).toHaveLength(1)
    // Nothing overwritten while the question is open.
    expect(store.get('customer:c1')?.fields).toEqual(current.fields)
  })

  it('refuses to rewrite recorded money, however the versions line up', () => {
    const result = resolve({
      entity: 'payment',
      current: { version: 1, fields: { amount_minor: 50_000_00 }, updatedBy: 'user-b' },
      incoming: { baseVersion: 1, fields: { amount_minor: 1 }, actorId: 'user-a', deviceId: 'device-a' },
    })
    expect(result.kind).toBe('rejected')
  })

  it('refuses an edit to an issued document', () => {
    const result = resolve({
      entity: 'document',
      current: { version: 1, fields: { note: 'x' }, updatedBy: 'user-b' },
      incoming: { baseVersion: 1, fields: { note: 'y' }, actorId: 'user-a', deviceId: 'device-a' },
      documentType: 'invoice',
      documentStatus: 'issued',
    })
    expect(result.kind).toBe('rejected')
  })

  it('lets only an entitled user resolve (§M)', () => {
    const result = resolve({
      entity: 'customer',
      current,
      incoming: { baseVersion: 4, fields: { note: 'mine' }, actorId: 'staff', deviceId: 'device-a' },
      actorMayResolve: false,
    })
    expect(result.kind).toBe('rejected')
  })
})

describe('Chaos 4 — clock skew (§Q)', () => {
  it('decides by revision, so a wrong device clock changes nothing', () => {
    // Device A's clock is a year fast. Its edit is still older by REVISION,
    // which is a fact about the record rather than an opinion about the device.
    const result = resolve({
      entity: 'customer',
      current: { version: 9, fields: { note: 'newer' }, updatedBy: 'user-b' },
      incoming: { baseVersion: 3, fields: { note: 'older' }, actorId: 'user-a', deviceId: 'device-a' },
    })
    expect(result.kind).toBe('conflict')
  })

  it('never silently prefers the later timestamp', () => {
    // There is no timestamp input to resolve() at all — the signature makes
    // last-write-wins impossible to implement by accident.
    const signature = resolve.toString()
    expect(signature).not.toContain('updatedAt')
    expect(signature).not.toContain('timestamp')
  })
})

describe('Chaos 5 — offline issue, then reconcile (§Q gate)', () => {
  it('gives five offline documents unique references', () => {
    const reservation: Reservation = {
      companyId: 'co', docType: 'invoice', deviceId: 'device-a',
      rangeStart: 1, rangeEnd: 3, next: 1,
    }
    let held: Reservation | null = reservation
    const references: string[] = []

    for (let i = 0; i < 5; i++) {
      const taken = takeNumber({
        reservation: held,
        prefix: 'INV',
        deviceId: 'device-a',
        localSequence: 100 + i,
      })
      held = taken.reservation
      references.push(taken.reference)
    }

    // Three from the block, then two device-qualified — all distinct, and
    // issuing never waited for the network.
    expect(new Set(references).size).toBe(5)
    expect(references.slice(0, 3)).toEqual(['INV-0001', 'INV-0002', 'INV-0003'])
    // The block covered i=0..2; i=3 falls back with localSequence 103.
    expect(references[3]).toMatch(/^INV-0103-[0-9A-Z]{2}$/)
  })

  it('never hands two devices overlapping blocks', () => {
    expect(() =>
      assertNoOverlap([
        { companyId: 'co', docType: 'invoice', deviceId: 'a', rangeStart: 1, rangeEnd: 10, next: 1 },
        { companyId: 'co', docType: 'invoice', deviceId: 'b', rangeStart: 10, rangeEnd: 20, next: 10 },
      ]),
    ).toThrow(NumberingError)
  })

  it('lets two devices hold adjacent blocks safely', () => {
    expect(() =>
      assertNoOverlap([
        { companyId: 'co', docType: 'invoice', deviceId: 'a', rangeStart: 1, rangeEnd: 10, next: 1 },
        { companyId: 'co', docType: 'invoice', deviceId: 'b', rangeStart: 11, rangeEnd: 20, next: 11 },
      ]),
    ).not.toThrow()
  })

  it('keeps the pull cursor put when a batch fails (§M)', () => {
    const local: LocalStore = {
      get: () => null,
      put: () => {
        throw new Error('disk full')
      },
    }
    expect(() =>
      applyPull(
        { cursor: 'next', records: [{ entity: 'customer', recordId: 'c1', version: 1, fields: {}, updatedBy: 'u' }] },
        local,
        { transaction: (work) => work() },
      ),
    ).toThrow(PullError)
  })

  it('does not let a stale update resurrect a deleted record (§Q gate)', () => {
    const result = resolve({
      entity: 'customer',
      current: { version: 9, fields: {}, deletedAt: '2026-09-10T00:00:00Z', updatedBy: 'user-b' },
      incoming: { baseVersion: 4, fields: { name: 'back from the dead' }, actorId: 'a', deviceId: 'd' },
    })
    expect(result.kind).toBe('ignored')
  })

  it('verifies an asset hash rather than trusting the transfer (§M)', () => {
    const asset: Asset = {
      id: 'a1', localPath: '/local/a1.jpg', hash: 'abc123', bytes: 1000,
      uploadState: 'uploading', uploadedBytes: 1000,
    }
    expect(verifyUpload(asset, 'abc123', 1000).uploadState).toBe('uploaded')
    // A corrupt arrival restarts rather than resuming the same bad file.
    const corrupt = verifyUpload(asset, 'wrong', 1000)
    expect(corrupt.uploadState).toBe('failed')
    expect(corrupt.uploadedBytes).toBe(0)
  })
})

describe('Chaos 6 — a region change racing a sync (§Q gate)', () => {
  it('never alters a frozen label', () => {
    const result = resolve({
      entity: 'document',
      current: { version: 1, fields: { frozen_labels: '{"printedTitle":"WAYBILL"}' }, updatedBy: 'b' },
      incoming: {
        baseVersion: 1,
        fields: { frozen_labels: '{"printedTitle":"DELIVERY NOTE"}' },
        actorId: 'a',
        deviceId: 'd',
      },
      documentType: 'waybill',
      documentStatus: 'draft',
    })
    expect(result.kind).toBe('rejected')
  })

  it('keeps an issued PDF in its original wording through the change', () => {
    const frozen = freezeLabels({ locale: 'EN-NG' }, 'waybill')
    // The company's locale settings sync to EN-GB mid-flight. The document
    // does not follow, because composition reads the frozen snapshot.
    const page = composeDocument(
      {
        type: 'waybill', status: 'issued', currency: 'NGN', reference: 'WAY-0001',
        issueDate: '2026-09-01', party: { name: 'Okoro & Sons' }, frozenLabels: frozen,
        lineItems: [],
      },
      {
        profile: { locale: 'EN-GB' },
        branding: { name: 'Co', nameStyle: 'classic', logoSize: 'M', showLogo: true },
        columnLabels: { description: 'D', quantity: 'Q', unit: 'U', amount: 'A' },
      },
    )
    expect(page.title).toBe('WAYBILL')
  })

  it('refuses to rewrite an issued reference', () => {
    const result = resolve({
      entity: 'document',
      current: { version: 1, fields: { issued_reference: 'INV-0001' }, updatedBy: 'b' },
      incoming: { baseVersion: 1, fields: { issued_reference: 'INV-9999' }, actorId: 'a', deviceId: 'd' },
    })
    expect(result.kind).toBe('rejected')
  })
})

describe('Dependencies resolve before dependents (§M)', () => {
  it('holds a document back until the customer it names is acknowledged', async () => {
    const server = fakeServer()
    const outbox = new Outbox()

    outbox.commit({ write: () => ({}), operation: operation('cust', { entity: 'customer' }) })
    outbox.commit({
      write: () => ({}),
      operation: operation('doc', { dependsOn: ['cust'] }),
    })

    // Only the customer is ready on the first pass.
    expect(outbox.ready(NOW).map((e) => e.operation.id)).toEqual(['cust'])

    await drain(outbox, server.send, NOW)
    expect([...server.received.keys()]).toEqual(['key-cust', 'key-doc'])
  })

  it('leaves a dependent queued when its parent fails', async () => {
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('cust', { entity: 'customer' }) })
    outbox.commit({ write: () => ({}), operation: operation('doc', { dependsOn: ['cust'] }) })

    await drain(outbox, async () => ({ ok: false, error: 'server down' }), NOW)

    const states = new Map(outbox.all().map((e) => [e.operation.id, e.state]))
    expect(states.get('cust')).toBe('failed')
    expect(states.get('doc')).toBe('pending')
  })
})

describe('Backoff spreads retries (§M)', () => {
  it('grows with attempts and stays capped', async () => {
    const outbox = new Outbox()
    outbox.commit({ write: () => ({}), operation: operation('op-1') })

    const times: number[] = []
    for (let attempt = 0; attempt < 12; attempt++) {
      await drain(outbox, async () => ({ ok: false, error: 'down' }), NOW, () => 1)
      const next = outbox.all()[0]?.nextAttemptAt
      if (next !== undefined) times.push(Date.parse(next) - Date.parse(NOW))
      // Move past the backoff so the next drain picks it up again.
      outbox.markInFlight('op-1')
      outbox.markFailed('op-1', 'down', NOW, () => 1)
    }

    expect(times[0]).toBeLessThan(times[times.length - 1] ?? 0)
    expect(Math.max(...times)).toBeLessThanOrEqual(5 * 60_000)
  })
})
