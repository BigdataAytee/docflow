/**
 * "Chase this money" (§G, §L1).
 *
 * "A green WhatsApp row drafting the REAL outstanding amount, due date and
 * ACTUAL bank details in the active language, with Softer and Firmer variants.
 * Nothing sends unseen."
 *
 * Two rules shape this:
 *
 *  · Every figure comes from the ledger and every bank line from the saved
 *    §J fields. Nothing is approximated, rounded for readability or filled in
 *    with a placeholder — a reminder quoting a number the customer does not
 *    recognise is worse than no reminder.
 *  · Composing is not sending. This returns text; handing it to WhatsApp is a
 *    separate, deliberate act, so "nothing sends unseen" is structural rather
 *    than a promise about how the button is wired.
 */

import type { Money } from '../../domain/money/money'
import { isPositive } from '../../domain/money/money'
import { paymentBoxRows } from '../../domain/locale/bank-fields'

export type ChaseTone = 'softer' | 'firmer'

export class ChaseError extends Error {}

export interface ChaseInput {
  readonly customerName: string
  readonly businessName: string
  readonly reference: string
  /** Straight from the ledger — never a stored or rounded figure (Rule #4). */
  readonly outstanding: Money
  readonly dueDate?: string
  readonly currency: string
  /** The saved §J fields. Absent ones are omitted, never invented. */
  readonly bankValues?: Readonly<Record<string, string>>
  readonly formatAmount: (amount: Money) => string
  readonly templates: ChaseTemplates
}

/** The words, resolved through the locale layer by the caller (Rule #5, §S). */
export interface ChaseTemplates {
  readonly softerOpening: string
  readonly firmerOpening: string
  readonly amountLine: string
  readonly dueLine: string
  readonly overdueLine: string
  readonly howToPay: string
  readonly closing: string
}

export interface ChaseMessage {
  readonly tone: ChaseTone
  readonly text: string
  /** What the message quotes, so a caller can show it before sending. */
  readonly quotedAmount: Money
}

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)

/**
 * Draft a reminder. Throws when there is nothing to chase — a reminder for a
 * settled invoice is the single worst thing this feature could produce.
 */
export function draftChase(input: ChaseInput, tone: ChaseTone, today?: string): ChaseMessage {
  if (!isPositive(input.outstanding)) {
    throw new ChaseError(
      'There is nothing outstanding on this document, so there is nothing to chase.',
    )
  }

  const amount = input.formatAmount(input.outstanding)
  const values = {
    customer: input.customerName,
    business: input.businessName,
    reference: input.reference,
    amount,
    due: input.dueDate ?? '',
  }

  const lines: string[] = [
    fill(tone === 'softer' ? input.templates.softerOpening : input.templates.firmerOpening, values),
    fill(input.templates.amountLine, values),
  ]

  if (input.dueDate !== undefined) {
    const overdue = today !== undefined && today > input.dueDate
    lines.push(fill(overdue ? input.templates.overdueLine : input.templates.dueLine, values))
  }

  // The real saved details, or nothing at all. paymentBoxRows already drops
  // empty fields, so a half-filled bank setup produces a shorter message
  // rather than a line reading "Account number: ".
  const bankRows = paymentBoxRows({
    currency: input.currency,
    values: input.bankValues ?? {},
  })
  if (bankRows.length > 0) {
    lines.push('', input.templates.howToPay)
    for (const row of bankRows) lines.push(`${row.label}: ${row.value}`)
  }

  lines.push('', fill(input.templates.closing, values))

  return { tone, text: lines.join('\n'), quotedAmount: input.outstanding }
}

/** Both variants, so the user picks rather than being given one (§G). */
export function draftBothTones(input: ChaseInput, today?: string): ChaseMessage[] {
  return (['softer', 'firmer'] as const).map((tone) => draftChase(input, tone, today))
}

/**
 * A share handoff records that sharing happened — never that the customer
 * received anything (§M: "A share handoff records a sharing event; it never
 * claims recipient delivery").
 */
export interface ShareEvent {
  readonly documentId: string
  readonly at: string
  readonly channel: 'whatsapp' | 'system_share'
  readonly quotedAmountMinor: number
}

export const shareEventFor = (
  documentId: string,
  message: ChaseMessage,
  at: string,
  channel: ShareEvent['channel'] = 'whatsapp',
): ShareEvent => ({
  documentId,
  at,
  channel,
  quotedAmountMinor: message.quotedAmount.minor,
})
