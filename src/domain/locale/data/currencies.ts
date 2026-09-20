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

/**
 * Currencies that are NOT two-decimal, as ISO 4217 defines them.
 *
 * This table is the reason the fallback below is safe to have at all. Rule #3
 * says money is integer minor units and never inferred — so a currency whose
 * subdivision is guessed at 100 when it is 1 does not merely display oddly, it
 * stores ¥1,000 as ¥10.00 and loses two orders of magnitude on every amount a
 * person enters. Nothing about that is recoverable later.
 *
 * `1` means no minor unit at all; `1000` means three decimals.
 */
const MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 1, CLP: 1, DJF: 1, GNF: 1, ISK: 1, JPY: 1, KMF: 1, KRW: 1, PYG: 1,
  RWF: 1, UGX: 1, VND: 1, VUV: 1, XAF: 1, XOF: 1, XPF: 1,
  BHD: 1000, IQD: 1000, JOD: 1000, KWD: 1000, LYD: 1000, OMR: 1000, TND: 1000,
}

/**
 * The field set for a currency with no §J definition of its own.
 *
 * §J's per-market field sets are still exactly as validated as they were —
 * `validated` stays false on everything, and `CURRENCIES` above is untouched.
 * What changed is the answer for a currency that is NOT in it. It used to be
 * an exception, which meant a trader in a country nobody had written a field
 * set for could not create a business, let alone send an invoice.
 *
 * Bank, account number, account name and SWIFT is the set that works
 * internationally: it is what a bank abroad needs to receive a transfer, and
 * it invents no local identifier — no sort code for a country that has none,
 * no IFSC outside India. Adding a market still means writing its real fields;
 * until somebody does, this asks for what is universally true instead of
 * refusing to take the payment.
 */
export function genericCurrency(code: string): CurrencyDefinition {
  return {
    code,
    // The ISO code as the symbol. Honest and unambiguous — "KES 4,500" reads
    // correctly everywhere, and a symbol guessed for the wrong country is
    // worse than no symbol at all.
    symbol: code,
    minorUnits: MINOR_UNITS[code] ?? 100,
    fields: [bank, accountNumber, accountName, { ...swift, required: false }],
    validated: false,
  }
}

/** The region's default currency (§D). The user may hold accounts in any. */
export const REGION_DEFAULT_CURRENCY: Readonly<Record<string, string>> = {
  NG: 'NGN', GH: 'GHS', GB: 'GBP', IE: 'EUR', US: 'USD', CA: 'CAD',
  // MX was 'USD'. Mexico's currency is the peso; the dollar was here because
  // MXN had no §J field set and the old code threw rather than falling back,
  // so a Mexican business would have been set up to invoice in dollars. That
  // is a money default, not a formatting preference.
  FR: 'EUR', CI: 'XOF', ES: 'EUR', MX: 'MXN', IN: 'INR', AE: 'AED',
  KE: 'KES', ZA: 'ZAR', AU: 'AUD', BR: 'BRL', EG: 'EGP', SG: 'SGD', CN: 'CNY',
}

/**
 * Every currency §J defines, for §G's picker on the Details card.
 *
 * Sorted, so the list reads the same every time it is opened — and derived
 * from `CURRENCIES` rather than written out, so a currency added to §J's
 * table is offered by having been added.
 */
export const CURRENCY_CODES: readonly string[] = Object.keys(CURRENCIES).sort()
