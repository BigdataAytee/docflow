/**
 * §J + §K — reading the currency definition, and validating what gets typed
 * into it without destroying the input.
 *
 * The settings form renders from `fieldsFor`, and the printed payment box reads
 * the same definition, so the two cannot drift (§J).
 */

import {
  type BankField,
  type CurrencyDefinition,
  CURRENCIES,
  genericCurrency,
} from './data/currencies'

export class CurrencyError extends Error {}

export function currencyDefinition(code: string): CurrencyDefinition {
  const normalised = code.trim().toUpperCase()
  const def = CURRENCIES[normalised]
  if (def !== undefined) return def

  /*
   * A currency with no §J definition gets the international field set rather
   * than an exception. The old behaviour — throw — was written to stop a
   * market's fields being guessed, which is right, but it was the only
   * behaviour, so a trader in an unlisted country could not create a business
   * at all. The guess it prevented has been replaced by asking for what is
   * true everywhere (bank, account number, name, optional SWIFT), and the
   * per-market sets above are still the only ones anybody claims are local.
   *
   * Still an error for a value that is not a currency code: that is a bug in
   * the caller, not an unlisted market, and defaulting it would hide it.
   */
  if (!/^[A-Z]{3}$/.test(normalised)) {
    throw new CurrencyError(
      `"${code}" is not an ISO 4217 currency code. A missing market falls back; a malformed code is a bug.`,
    )
  }
  return genericCurrency(normalised)
}

/** The fields to render, in printed order. One source for form and PDF (§J). */
export const fieldsFor = (code: string): readonly BankField[] =>
  currencyDefinition(code).fields

export const symbolFor = (code: string): string => currencyDefinition(code).symbol
export const minorUnitsFor = (code: string): number => currencyDefinition(code).minorUnits

/**
 * Where the account is held, kept beside the account's own fields (§J).
 *
 * NOT a §J field, and deliberately not a column either. It is one string
 * that is almost always the business's own region, so a migration across
 * three backends for it would be machinery in exchange for nothing — and
 * `bankFields` is already a synced `Record<string, string>` going to the same
 * place at the same time.
 *
 * SAFE TO PUT THERE because everything that reads `bankFields` iterates the
 * DEFINITION rather than the map: `paymentBoxRows` and `validateBankDetails`
 * both walk `fieldsFor(currency)`, so a key no currency declares is invisible
 * to the printed box and to validation. The constant lives here, next to the
 * definitions, so the one rule it depends on — that no field kind is ever
 * called this — is checked where the kinds are.
 */
export const ACCOUNT_COUNTRY_KEY = 'account_country'

export interface BankDetails {
  readonly currency: string
  readonly values: Readonly<Record<string, string>>
}

export interface FieldProblem {
  readonly kind: string
  readonly message: string
}

/**
 * §K — "Validate without destroying what was typed." This reports problems; it
 * never rewrites or clears the caller's input. Spaces and hyphens are allowed
 * for readability, and leading zeroes always survive because every identifier
 * is a string.
 */
export function validateBankDetails(details: BankDetails): FieldProblem[] {
  const problems: FieldProblem[] = []

  for (const field of fieldsFor(details.currency)) {
    const raw = details.values[field.kind]
    const value = raw?.trim() ?? ''

    if (value === '') {
      if (field.required) {
        problems.push({ kind: field.kind, message: `${field.label} is needed.` })
      }
      continue
    }

    if (field.normalize === 'upper_no_spaces') {
      // Case and spacing are normalized for comparison only — §K keeps the
      // entered value on failure, so nothing the user typed is lost.
      const normalized = normalizeIdentifier(value)
      if (!/^[A-Z0-9]+$/.test(normalized)) {
        problems.push({
          kind: field.kind,
          message: `${field.label} should be letters and numbers only.`,
        })
      }
    }
  }

  return problems
}

/** Uppercase, spaces and hyphens removed. For comparison, never for storage. */
export const normalizeIdentifier = (value: string): string =>
  value.replace(/[\s-]/g, '').toLocaleUpperCase()

/**
 * The rows the printed payment box renders — labels in a left column so values
 * align (§I). Empty optional fields are dropped; nothing is invented.
 */
export function paymentBoxRows(details: BankDetails): { label: string; value: string }[] {
  return fieldsFor(details.currency)
    .map((field) => ({ label: field.label, value: details.values[field.kind]?.trim() ?? '' }))
    .filter((row) => row.value !== '')
}
