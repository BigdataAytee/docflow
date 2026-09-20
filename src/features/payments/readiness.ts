/**
 * Whether a switched-on payment method can actually be used (§J, §G step 5).
 *
 * §G validates payment setup at final invoice issue, and the check it grew up
 * with was `enabledPaymentMethodCount === 0` — PRESENCE, not usability. So an
 * owner could switch bank transfer on, leave the three fields empty, and
 * issue: `buildPaymentBox` filters out empty rows, finds none, and returns
 * null. The invoice printed with no HOW TO PAY box at all. The customer got a
 * bill with no way to pay it, and the first anybody heard of it was when the
 * money did not arrive.
 *
 * Blocking at issue is not a new burden. The person was blocked either way —
 * the difference is whether they find out here, with a one-tap route to the
 * panel, or a week later through their customer.
 *
 * THE FIELDS COME FROM §J'S CURRENCY DEFINITION, never from a list written
 * here. `fieldsFor('NGN')` is Bank, Account number, Account name, and that
 * same definition renders the settings form and the printed box — so this
 * cannot demand a field the form does not offer, and no sort code can be
 * invented for a country that has none.
 *
 * A method with nothing to configure — cash on delivery is an arrangement
 * between the owner and the customer — is usable the moment it is on.
 */

import { validateBankDetails } from '../../domain/locale/bank-fields'
import type { SavedPaymentLink } from '../../domain/payments/links'

export interface PaymentReadiness {
  readonly currency: string
  readonly enabled: readonly string[]
  readonly bankValues: Readonly<Record<string, string>>
  /**
   * §J's pasted links, which are a way to be paid like any other.
   *
   * FOUND ON THE PHONE. A trader pasted their Paystack page into the new
   * control on the invoice, watched "Paystack — paystack.com/pay/…" appear
   * in HOW TO PAY on the page in front of them, and was still told "Before
   * you can issue this: set up how you get paid".
   *
   * The gate counted `enabledPaymentMethods` and links do not live there. But
   * the gate exists to stop an invoice a customer has no way to pay, and that
   * customer had one — printed, in words, on the document. Refusing over it
   * is the check mistaking its own bookkeeping for the thing it protects.
   */
  readonly links?: readonly SavedPaymentLink[]
}

/** Enabled methods that cannot be used yet, by id. Empty means all are ready. */
export function unusableMethods(state: PaymentReadiness): string[] {
  return state.enabled.filter((id) => {
    if (id !== 'bank_transfer') return false
    return validateBankDetails({ currency: state.currency, values: state.bankValues }).length > 0
  })
}

/**
 * How many enabled methods a customer could actually pay through.
 *
 * This is the number §G's issue gate cares about. An owner with bank transfer
 * on and nothing filled has one enabled method and zero usable ones.
 */
export function usableMethodCount(state: PaymentReadiness): number {
  /*
   * A LINK COUNTS, and only one with something in it. An empty value cannot
   * be saved through the form, so this is belt and braces rather than a
   * second rule — the same posture `unusableMethods` takes to a bank
   * transfer switched on over three empty fields.
   */
  const usableLinks = (state.links ?? []).filter((link) => link.value.trim() !== '').length
  return state.enabled.length - unusableMethods(state).length + usableLinks
}
