/**
 * §J bank-field definitions. The field sets are product samples pending
 * per-market validation (§W) — what these tests pin is the SHAPE: that the
 * settings form and the printed payment box read one definition, that no field
 * is invented for a country that lacks it, and that identifiers survive intact.
 */

import { describe, expect, it } from 'vitest'

import { CURRENCIES, REGION_DEFAULT_CURRENCY } from './data/currencies'
import {
  CurrencyError,
  fieldsFor,
  normalizeIdentifier,
  paymentBoxRows,
  validateBankDetails,
} from './bank-fields'

describe('NGN prints exactly bank / account number / account name (§J, §V)', () => {
  // §J is explicit and singled out: "three fields, no sort code". The home
  // market's case, and the one the acceptance checklist names by hand.
  it('defines exactly three fields, in printed order', () => {
    expect(fieldsFor('NGN').map((f) => f.label)).toEqual([
      'Bank',
      'Account number',
      'Account name',
    ])
  })

  it('has no sort code, routing number, IBAN, SWIFT or branch field', () => {
    const kinds = fieldsFor('NGN').map((f) => f.kind)
    for (const absent of ['sort_code', 'routing_number', 'iban', 'swift', 'branch', 'branch_code']) {
      expect(kinds, `NGN must not carry ${absent}`).not.toContain(absent)
    }
  })

  it('prints those three rows and nothing else', () => {
    expect(
      paymentBoxRows({
        currency: 'NGN',
        values: {
          bank_name: 'Guaranty Trust Bank',
          account_number: '0123456789',
          account_name: 'Dynamic Renaissance Business Enterprises Ltd',
        },
      }),
    ).toEqual([
      { label: 'Bank', value: 'Guaranty Trust Bank' },
      { label: 'Account number', value: '0123456789' },
      { label: 'Account name', value: 'Dynamic Renaissance Business Enterprises Ltd' },
    ])
  })

  it('keeps a leading zero on the account number (§K)', () => {
    const rows = paymentBoxRows({
      currency: 'NGN',
      values: { bank_name: 'GTB', account_number: '0001234567', account_name: 'Ltd' },
    })
    expect(rows[1]?.value).toBe('0001234567')
  })
})

describe('One definition, read by the form and the PDF (§J)', () => {
  it('gives every currency a bank and an account name', () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      const kinds = def.fields.map((f) => f.kind)
      expect(kinds, `${code} has no bank field`).toContain('bank_name')
      expect(kinds, `${code} has no account name`).toContain('account_name')
    }
  })

  it('never repeats a field within a currency', () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      const kinds = def.fields.map((f) => f.kind)
      expect(new Set(kinds).size, `${code} repeats a field`).toBe(kinds.length)
    }
  })

  it('transcribes the §J table without adding to it', () => {
    expect(fieldsFor('GBP').map((f) => f.label)).toEqual([
      'Bank', 'Sort code', 'Account number', 'Account name',
    ])
    expect(fieldsFor('EUR').map((f) => f.label)).toEqual([
      'Bank', 'IBAN', 'BIC/SWIFT', 'Account name',
    ])
    expect(fieldsFor('INR').map((f) => f.label)).toEqual([
      'Bank', 'Account number', 'IFSC code', 'Account name',
    ])
    expect(fieldsFor('BRL').map((f) => f.label)).toEqual([
      'Bank', 'Agência', 'Conta', 'Account name',
    ])
  })

  it('refuses a currency it has no definition for, rather than guessing', () => {
    // CLAUDE.md: never invent banking rules. An unknown market is an error,
    // not a best-effort field set.
    expect(() => fieldsFor('JPY')).toThrow(CurrencyError)
  })

  it('marks every definition unvalidated until an in-market review (§W)', () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(def.validated, `${code} claims validation it has not had`).toBe(false)
    }
  })

  it('points every launch region at a currency it has a definition for', () => {
    for (const [region, code] of Object.entries(REGION_DEFAULT_CURRENCY)) {
      expect(CURRENCIES[code], `${region} defaults to undefined currency ${code}`).toBeDefined()
    }
  })
})

describe('Validation keeps what was typed (§K)', () => {
  it('accepts an IBAN written with spaces for readability', () => {
    expect(
      validateBankDetails({
        currency: 'EUR',
        values: {
          bank_name: 'BNP',
          iban: 'FR14 2004 1010 0505 0001 3M02 606',
          swift: 'BNPAFRPP',
          account_name: 'Société Générale Ltd',
        },
      }),
    ).toEqual([])
  })

  it('names the missing field without clearing the rest', () => {
    const problems = validateBankDetails({
      currency: 'GBP',
      values: { bank_name: 'Barclays', account_number: '12345678', account_name: 'Ltd' },
    })
    expect(problems.map((p) => p.kind)).toEqual(['sort_code'])
  })

  it('normalizes identifiers for comparison only', () => {
    expect(normalizeIdentifier('gb29 nwbk-6016 1331 9268 19')).toBe('GB29NWBK60161331926819')
  })

  it('rejects punctuation in an identifier but keeps the value the caller holds', () => {
    const values = { bank_name: 'HDFC', account_number: '1', ifsc: 'HDFC/0001', account_name: 'X' }
    const problems = validateBankDetails({ currency: 'INR', values })
    expect(problems.map((p) => p.kind)).toEqual(['ifsc'])
    expect(values.ifsc).toBe('HDFC/0001')
  })
})
