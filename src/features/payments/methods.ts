/**
 * How the money arrived, in words (§J, §S).
 *
 * §E stores a method as a token — `bank_transfer` — because a stored value has
 * to mean the same thing in every language and outlive any wording change. The
 * owner must never SEE that token, so the one place it is turned into words is
 * here, and every screen that shows or offers a method goes through it.
 *
 * An unknown token is shown as itself rather than hidden: a payment recorded
 * by a provider this build has no word for is still money, and dropping the
 * method would lose evidence (§V).
 */

import type { UiStrings } from '../../domain/locale/data/strings'

export interface PaymentMethod {
  readonly id: string
  readonly name: string
}

/** Bank transfer is the one §J ships; cards and wallets arrive with §U. */
export const ALWAYS_AVAILABLE = ['bank_transfer'] as const

export function methodName(strings: UiStrings, id: string): string {
  switch (id) {
    case 'bank_transfer':
      return strings.settings.bankTransfer
    default:
      return id
  }
}

/**
 * The methods a payment may be recorded under.
 *
 * The list never empties. An owner who has switched everything off still has
 * money in the till, and an empty picker would block recording it (Rule #1) —
 * so what §J always supports is offered regardless.
 */
export function availableMethods(
  enabled: readonly string[],
  strings: UiStrings,
): PaymentMethod[] {
  const chosen = ALWAYS_AVAILABLE.filter((id) => enabled.includes(id))
  const ids = chosen.length === 0 ? ALWAYS_AVAILABLE : chosen
  return ids.map((id) => ({ id, name: methodName(strings, id) }))
}
