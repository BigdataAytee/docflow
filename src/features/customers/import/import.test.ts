/**
 * Importing customers (§Q Phase 4).
 *
 * The dedupe tests are the ones that matter. A phone address book holds the
 * same person three times — SIM, Google, WhatsApp — and an import that trusts
 * it gives the owner three "Musa Ibrahim"s. They then record a payment against
 * one of them, and a customer balance is wrong in a way nothing will ever
 * flag: the money is exact and attached to the wrong person.
 */

import { describe, expect, it } from 'vitest'

import type { Customer } from '../../../data/repositories'
import {
  type ImportCandidate,
  foldName,
  normaliseEmail,
  normalisePhone,
  plan,
} from './dedupe'
import { guessMapping, isMappable, parseCsv, toCandidates } from './csv'

const customer = (over: Partial<Customer>): Customer => ({
  id: 'cus_1',
  companyId: 'co_acme',
  kind: 'person',
  name: 'Musa Ibrahim',
  labels: [],
  ...over,
})

describe('A phone number is the same number however it was typed', () => {
  it('folds the formats one address book holds at once', () => {
    const forms = ['0803 123 4567', '+234 803 123 4567', '234-803-123-4567', '(0803) 1234567']
    const normalised = forms.map(normalisePhone)
    expect(new Set(normalised).size).toBe(1)
    // The last nine digits: long enough that two real numbers do not
    // collide, short enough to survive any country code or leading zero.
    expect(normalised[0]).toBe('031234567')
  })

  it('keeps genuinely different numbers apart', () => {
    expect(normalisePhone('0803 123 4567')).not.toBe(normalisePhone('0803 123 4568'))
  })

  it('refuses something too short to be a number', () => {
    // A phone book holds these: "911", an extension, a stray digit.
    expect(normalisePhone('911')).toBeNull()
    expect(normalisePhone('')).toBeNull()
    expect(normalisePhone(undefined)).toBeNull()
  })
})

describe('Email and name folding', () => {
  it('lower-cases an email and refuses a non-address', () => {
    expect(normaliseEmail('  Musa@Example.COM ')).toBe('musa@example.com')
    expect(normaliseEmail('not an email')).toBeNull()
  })

  it('collapses spacing in a name without matching fuzzily', () => {
    expect(foldName('  Musa   Ibrahim ')).toBe('musa ibrahim')
    // Two real businesses are called this. Merging them silently would be
    // worse than importing both: a duplicate can be deleted, a merge cannot
    // be undone.
    expect(foldName('City Ventures')).not.toBe(foldName('City Ventures Ltd'))
  })
})

describe('Planning an import', () => {
  it('marks a contact already in the book as a duplicate, by phone', () => {
    const existing = [customer({ phone: '+234 803 123 4567' })]
    const result = plan([{ name: 'M. Ibrahim', phone: '08031234567' }], existing)

    expect(result.toCreate).toBe(0)
    expect(result.rows[0]?.verdict).toMatchObject({ kind: 'duplicate', matchedOn: 'phone' })
  })

  it('prefers a phone match over a coincidence of names', () => {
    const existing = [
      customer({ id: 'cus_phone', name: 'Different Spelling', phone: '08031234567' }),
      customer({ id: 'cus_name', name: 'Musa Ibrahim' }),
    ]
    const result = plan([{ name: 'Musa Ibrahim', phone: '08031234567' }], existing)

    const verdict = result.rows[0]?.verdict
    expect(verdict).toMatchObject({ kind: 'duplicate', matchedOn: 'phone' })
    expect(verdict?.kind === 'duplicate' ? verdict.of.id : null).toBe('cus_phone')
  })

  it('collapses the same person appearing three times in ONE import', () => {
    // The SIM copy, the Google copy and the WhatsApp copy.
    const candidates: ImportCandidate[] = [
      { name: 'Musa Ibrahim', phone: '08031234567' },
      { name: 'Musa Ibrahim', phone: '+2348031234567' },
      { name: 'Musa', phone: '0803 123 4567' },
    ]
    const result = plan(candidates, [])

    expect(result.toCreate).toBe(1)
    expect(result.duplicates).toBe(2)
    expect(result.rows.map((row) => row.verdict.kind)).toEqual(['new', 'repeated', 'repeated'])
  })

  it('imports two different people with the same first name', () => {
    const result = plan(
      [
        { name: 'Musa Ibrahim', phone: '08031234567' },
        { name: 'Musa Okoro', phone: '08039999999' },
      ],
      [],
    )
    expect(result.toCreate).toBe(2)
  })

  it('refuses a contact with no name rather than importing an unfindable row', () => {
    const result = plan([{ name: '   ', phone: '08031234567' }], [])
    expect(result.unusable).toBe(1)
    expect(result.toCreate).toBe(0)
  })

  it('writes nothing — it only says what would happen', () => {
    const existing = [customer({})]
    plan([{ name: 'Someone New' }], existing)
    // The preview screen shows this; the importer then writes only the `new`
    // rows. The same decision is shown and acted on, not computed twice.
    expect(existing).toHaveLength(1)
  })
})

describe('Reading a CSV somebody exported from something else', () => {
  it('handles quotes, doubled quotes and newlines inside a field', () => {
    const csv = 'Name,Address\n"Okoro, Sons","12 Broad St\nLagos"\n"He said ""hi""",Ikeja\n'
    const parsed = parseCsv(csv)

    expect(parsed.headers).toEqual(['Name', 'Address'])
    expect(parsed.rows[0]).toEqual(['Okoro, Sons', '12 Broad St\nLagos'])
    expect(parsed.rows[1]).toEqual(['He said "hi"', 'Ikeja'])
  })

  it('strips the BOM Excel writes', () => {
    // Left in, it becomes part of the first heading and the mapping stops
    // recognising a column called "name".
    const parsed = parseCsv('﻿Name,Phone\nOkoro,0803\n')
    expect(parsed.headers[0]).toBe('Name')
    expect(isMappable(guessMapping(parsed.headers))).toBe(true)
  })

  it('does not invent a row from a trailing newline', () => {
    expect(parseCsv('Name\nOkoro\n').rows).toHaveLength(1)
  })
})

describe('Guessing the column mapping', () => {
  it('recognises the headings other tools actually use', () => {
    const mapping = guessMapping(['Customer Name', 'Mobile Number', 'E-Mail', 'Street Address'])
    expect(mapping).toEqual({ name: 0, phone: 1, email: 2, address: 3 })
  })

  it('gives an exact match priority over a prefix one', () => {
    // Both could be "the name column". `Name` is the exact one.
    const mapping = guessMapping(['Company Name', 'Name'])
    expect(mapping.name).toBe(1)
  })

  it('never assigns one column to two fields', () => {
    const mapping = guessMapping(['Contact'])
    const assigned = Object.values(mapping).filter((index) => index !== null)
    expect(new Set(assigned).size).toBe(assigned.length)
  })

  it('leaves a field unmapped rather than guessing at it', () => {
    const mapping = guessMapping(['Name', 'Notes', 'Balance'])
    expect(mapping.phone).toBeNull()
    expect(mapping.address).toBeNull()
  })

  it('refuses an import with no name column', () => {
    expect(isMappable(guessMapping(['Phone', 'Email']))).toBe(false)
  })
})

describe('Rows to candidates', () => {
  it('uses the mapping it was given, not the one it would have guessed', () => {
    const parsed = parseCsv('A,B\nOkoro,08031234567\n')
    // The owner corrected the guess. What is written must match what they saw.
    const candidates = toCandidates(parsed, { name: 0, phone: 1, email: null, address: null })
    expect(candidates).toEqual([{ name: 'Okoro', phone: '08031234567' }])
  })

  it('omits an empty cell rather than storing an empty string', () => {
    const parsed = parseCsv('Name,Phone\nOkoro,\n')
    const candidates = toCandidates(parsed, { name: 0, phone: 1, email: null, address: null })
    expect(candidates[0]).not.toHaveProperty('phone')
  })
})
