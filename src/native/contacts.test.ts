/**
 * Flattening a phone contact into a customer (§Q Phase 4, §E).
 *
 * A contact has three numbers, two emails and a photo. A customer record has
 * one phone and one email (§E). Getting that reduction wrong is not cosmetic:
 * joining three numbers into one field produces a phone number that cannot be
 * dialled AND cannot be matched by the dedupe, so the same person imports
 * again next time.
 */

import { describe, expect, it } from 'vitest'

import { type RawContact, toCandidate } from './contacts'

describe('toCandidate', () => {
  it('takes the first phone and the first email, not all of them', () => {
    const contact: RawContact = {
      name: { display: 'Musa Ibrahim' },
      phones: [{ number: '08031234567' }, { number: '08039999999' }],
      emails: [{ address: 'musa@example.com' }, { address: 'old@example.com' }],
    }

    expect(toCandidate(contact)).toEqual({
      name: 'Musa Ibrahim',
      phone: '08031234567',
      email: 'musa@example.com',
    })
  })

  it('skips an empty entry rather than taking it as the first', () => {
    // Address books hold these: a phone row with no number at all.
    const contact: RawContact = {
      name: { display: 'Okoro' },
      phones: [{ number: '  ' }, { number: null }, { number: '08031234567' }],
    }
    expect(toCandidate(contact).phone).toBe('08031234567')
  })

  it('omits a field the contact does not have', () => {
    const candidate = toCandidate({ name: { display: 'Okoro' } })
    expect(candidate).toEqual({ name: 'Okoro' })
    // Not `phone: undefined` — an absent key, so the dedupe reads it as
    // "no phone" rather than as a phone it must compare.
    expect('phone' in candidate).toBe(false)
  })

  it('joins a postal address into one line', () => {
    const candidate = toCandidate({
      name: { display: 'Okoro' },
      postalAddresses: [{ street: '12 Broad St', city: 'Lagos' }],
    })
    expect(candidate.address).toBe('12 Broad St, Lagos')
  })

  it('keeps a half-filled address rather than dropping it', () => {
    const candidate = toCandidate({
      name: { display: 'Okoro' },
      postalAddresses: [{ city: 'Lagos' }],
    })
    expect(candidate.address).toBe('Lagos')
  })

  it('survives a contact with nothing in it', () => {
    // A calendar invite leaves these behind. `plan` marks it unusable; what
    // matters here is that reading it does not throw mid-import and lose the
    // other four hundred.
    expect(() => toCandidate({})).not.toThrow()
    expect(toCandidate({}).name).toBe('')
  })

  it('trims the display name', () => {
    expect(toCandidate({ name: { display: '  Musa Ibrahim ' } }).name).toBe('Musa Ibrahim')
  })
})
