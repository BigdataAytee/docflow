/**
 * The deletion rules (§S, §V; Apple 5.1.1(v)).
 */

import { describe, expect, it } from 'vitest'

import {
  GRACE_DAYS,
  type Lifecycle,
  TOMBSTONE_FIELDS,
  canRequest,
  cancelDeletion,
  confirms,
  daysLeft,
  isPurgeDue,
  purge,
  requestDeletion,
} from './deletion'

const NOW = new Date('2026-09-14T09:00:00.000Z')
const later = (days: number) => new Date(NOW.getTime() + days * 86_400_000)

const active: Lifecycle = { state: 'active' }

const ask = (over: Partial<Parameters<typeof requestDeletion>[0]> = {}) =>
  requestDeletion({
    lifecycle: active,
    companyId: 'co_1',
    companyName: 'Dynamic Renaissance Ltd',
    requestedBy: 'user_1',
    role: 'owner',
    typedName: 'Dynamic Renaissance Ltd',
    exported: true,
    now: NOW,
    ...over,
  })

describe('Who may end a company', () => {
  it('is the owner, and nobody a permission can promote', () => {
    expect(canRequest('owner')).toBe(true)
    expect(canRequest('admin')).toBe(false)
    expect(canRequest('staff')).toBe(false)

    // §P puts permissions on the server, and this is the one action no
    // permission grants: an admin who can delete the company can end the
    // business's records in an afternoon.
    expect(ask({ role: 'admin' })).toEqual({ ok: false, why: 'not_owner' })
  })

  it('wants the business name typed, not a checkbox ticked', () => {
    expect(ask({ typedName: 'yes' })).toEqual({ ok: false, why: 'name_mismatch' })
    expect(ask({ typedName: 'DELETE' })).toEqual({ ok: false, why: 'name_mismatch' })
    expect(ask({ typedName: '  dynamic renaissance ltd  ' }).ok).toBe(true)
  })

  it('never accepts an empty name as a match for an empty company', () => {
    // A company with no name would otherwise be deletable by typing nothing.
    expect(confirms('', '')).toBe(false)
    expect(ask({ companyName: '', typedName: '' })).toEqual({ ok: false, why: 'name_mismatch' })
  })

  it('will not schedule twice', () => {
    const first = ask()
    if (!first.ok) throw new Error('expected a request')
    expect(ask({ lifecycle: { state: 'scheduled', request: first.value } })).toEqual({
      ok: false,
      why: 'already_scheduled',
    })
  })
})

describe('The window belongs to the person leaving', () => {
  it('is thirty days, and says so in the record itself', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')

    expect(asked.value.purgeAfter).toBe(later(GRACE_DAYS).toISOString())
    expect(daysLeft(asked.value, NOW)).toBe(GRACE_DAYS)
    expect(daysLeft(asked.value, later(29))).toBe(1)
  })

  it('never reports a negative number of days', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')
    expect(daysLeft(asked.value, later(90))).toBe(0)
  })

  it('destroys nothing before the date the person was given', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')

    expect(isPurgeDue(asked.value, later(GRACE_DAYS - 1))).toBe(false)
    expect(purge(asked.value, later(GRACE_DAYS - 1))).toEqual({ ok: false, why: 'too_early' })

    expect(isPurgeDue(asked.value, later(GRACE_DAYS))).toBe(true)
    expect(purge(asked.value, later(GRACE_DAYS)).ok).toBe(true)
  })

  it('cancels in one tap, with no name to type', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')
    const scheduled: Lifecycle = { state: 'scheduled', request: asked.value }

    // Asymmetric on purpose: destroying is slow and deliberate, recovering is
    // immediate. Anything else punishes the mistake the window exists for.
    expect(cancelDeletion(scheduled, 'owner')).toEqual({ ok: true, value: { state: 'active' } })
    expect(cancelDeletion(active, 'owner')).toEqual({ ok: false, why: 'not_scheduled' })
    expect(cancelDeletion(scheduled, 'admin')).toEqual({ ok: false, why: 'not_owner' })
  })

  it('records whether the archive was taken, without demanding it', () => {
    // Rule #6: export is free forever — not a toll on the way out.
    const declined = ask({ exported: false })
    expect(declined.ok).toBe(true)
    if (declined.ok) expect(declined.value.exported).toBe(false)
  })
})

describe('What survives is ids and dates, and nothing else', () => {
  it('keeps no name, no email, no document and no amount', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')
    const purged = purge(asked.value, later(GRACE_DAYS))
    if (!purged.ok) throw new Error('expected a tombstone')

    expect(Object.keys(purged.value).sort()).toEqual([...TOMBSTONE_FIELDS].sort())

    // The company NAME was in scope for the whole flow — it is what the owner
    // typed to confirm — so this is the field most likely to be kept "just
    // for support". It is not kept.
    const written = JSON.stringify(purged.value)
    expect(written).not.toContain('Dynamic Renaissance')
  })

  it('can still answer "was this deleted, and when"', () => {
    const asked = ask()
    if (!asked.ok) throw new Error('expected a request')
    const purged = purge(asked.value, later(GRACE_DAYS))
    if (!purged.ok) throw new Error('expected a tombstone')

    expect(purged.value.companyId).toBe('co_1')
    expect(purged.value.requestedAt).toBe(NOW.toISOString())
    expect(purged.value.purgedAt).toBe(later(GRACE_DAYS).toISOString())
  })
})
