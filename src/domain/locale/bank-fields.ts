/**
 * §J + §K — reading the currency definition, and validating what gets typed
 * into it without destroying the input.
 *
 * The settings form renders from `fieldsFor`, and the printed payment box reads
 * the same definition, so the two cannot drift (§J).
 */

import { type BankField, type CurrencyDefinition, CURRENCIES } from './data/currencies'

export class CurrencyError extends Error {}

export function currencyDefinition(code: string): CurrencyDefinition {
  const def = CURRENCIES[code]
  if (def === undefined) {
    throw new CurrencyError(
      `No field definition for ${code}. §J field sets are per-market and must be added deliberately, never guessed (CLAUDE.md).`,
    )
  }
  return def
}

/** The fields to render, in printed order. One source for form and PDF (§J). */
export const fieldsFor = (code: string): readonly BankField[] =>
  currencyDefinition(code).fields

export const symbolFor = (code: string): string => currencyDefinition(code).symbol
export const minorUnitsFor = (code: string): number => currencyDefinition(code).minorUnits

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
