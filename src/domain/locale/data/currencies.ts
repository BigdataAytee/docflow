/**
 * §J — one definition per currency, read by BOTH the settings form and the
 * printed payment box, so they cannot drift and no field can be invented for a
 * country that lacks one.
 *
 * ⚠ These are the spec's PROPOSED field sets, not verified banking standards.
 * §J and §W both hold them open for per-market validation, and CLAUDE.md
 * forbids inventing banking rules — so every definition carries
 * `validated: false` until an in-market review signs it off, exactly like the
 * terminology tables. Nothing here was added beyond what §J lists.
 */

export type BankFieldKind =
  | 'bank_name'
  | 'account_name'
  | 'account_number'
  | 'sort_code'
  | 'routing_number'
  | 'iban'
  | 'swift'
  | 'branch'
  | 'branch_code'
  | 'transit_number'
  | 'bsb'
  | 'ifsc'
  | 'agencia'
  | 'conta'

export interface BankField {
  readonly kind: BankFieldKind
  /** The label on the settings form and in the printed payment box's left column. */
  readonly label: string
  readonly required: boolean
  /**
   * Identifiers are STRINGS — leading zeroes are significant and must survive
   * (§K). Nothing here is ever parsed as a number.
   */
  readonly normalize?: 'upper_no_spaces'
}

export interface CurrencyDefinition {
  readonly code: string
  readonly symbol: string
  /** Minor units per major unit. 100 for kobo/pence/cents. */
  readonly minorUnits: number
  readonly fields: readonly BankField[]
  /** False until an in-market review confirms the field set (§W). */
  readonly validated: boolean
}

const bank: BankField = { kind: 'bank_name', label: 'Bank', required: true }
const accountName: BankField = { kind: 'account_name', label: 'Account name', required: true }
const accountNumber: BankField = {
  kind: 'account_number',
  label: 'Account number',
  required: true,
}
const swift: BankField = {
  kind: 'swift',
  label: 'SWIFT',
  required: true,
  normalize: 'upper_no_spaces',
}
const iban: BankField = { kind: 'iban', label: 'IBAN', required: true, normalize: 'upper_no_spaces' }

const define = (
  code: string,
  symbol: string,
  fields: readonly BankField[],
  minorUnits = 100,
): CurrencyDefinition => ({ code, symbol, minorUnits, fields, validated: false })

export const CURRENCIES: Readonly<Record<string, CurrencyDefinition>> = {
  // §J is explicit: three fields, NO sort code. The home market's case.
  NGN: define('NGN', '₦', [bank, accountNumber, accountName]),

  GBP: define('GBP', '£', [
    bank,
    { kind: 'sort_code', label: 'Sort code', required: true },
    accountNumber,
    accountName,
  ]),

  USD: define('USD', '$', [
    bank,
    { kind: 'routing_number', label: 'Routing number', required: true },
    accountNumber,
    accountName,
  ]),

  EUR: define('EUR', '€', [
    bank,
    iban,
    { kind: 'swift', label: 'BIC/SWIFT', required: true, normalize: 'upper_no_spaces' },
    accountName,
  ]),

  GHS: define('GHS', '₵', [
    bank,
    accountNumber,
    { kind: 'branch', label: 'Branch', required: true },
    accountName,
  ]),

  KES: define('KES', 'KSh', [
    bank,
    accountNumber,
    { kind: 'branch_code', label: 'Branch code', required: true },
    accountName,
  ]),
  ZAR: define('ZAR', 'R', [
    bank,
    accountNumber,
    { kind: 'branch_code', label: 'Branch code', required: true },
    accountName,
  ]),

  XOF: define('XOF', 'CFA', [bank, iban, swift, accountName], 1),
  XAF: define('XAF', 'FCFA', [bank, iban, swift, accountName], 1),
  AED: define('AED', 'د.إ', [bank, iban, swift, accountName]),

  EGP: define('EGP', 'E£', [bank, accountNumber, swift, accountName]),
  SGD: define('SGD', 'S$', [bank, accountNumber, swift, accountName]),
  CNY: define('CNY', '¥', [bank, accountNumber, swift, accountName]),

  CAD: define('CAD', 'C$', [
    bank,
    { kind: 'transit_number', label: 'Transit number', required: true },
    accountNumber,
    accountName,
  ]),

  AUD: define('AUD', 'A$', [
    bank,
    { kind: 'bsb', label: 'BSB', required: true },
    accountNumber,
    accountName,
  ]),

  INR: define('INR', '₹', [
    bank,
    accountNumber,
    { kind: 'ifsc', label: 'IFSC code', required: true, normalize: 'upper_no_spaces' },
    accountName,
  ]),

  BRL: define('BRL', 'R$', [
    bank,
    { kind: 'agencia', label: 'Agência', required: true },
    { kind: 'conta', label: 'Conta', required: true },
    accountName,
  ]),
}

/** The region's default currency (§D). The user may hold accounts in any. */
export const REGION_DEFAULT_CURRENCY: Readonly<Record<string, string>> = {
  NG: 'NGN', GH: 'GHS', GB: 'GBP', IE: 'EUR', US: 'USD', CA: 'CAD',
  FR: 'EUR', CI: 'XOF', ES: 'EUR', MX: 'USD', IN: 'INR', AE: 'AED',
  KE: 'KES', ZA: 'ZAR', AU: 'AUD', BR: 'BRL', EG: 'EGP', SG: 'SGD', CN: 'CNY',
}
