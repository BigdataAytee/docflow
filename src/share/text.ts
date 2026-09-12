/**
 * The share text (§D, §M, Rule #5).
 *
 * §C is explicit: "no hardcoded type name anywhere in UI, PDF or share-text
 * code". So every word of what goes out resolves through the locale layer, and
 * for an ISSUED document it resolves through the FROZEN labels — a document
 * shared today reads in the language and terminology it was issued under, even
 * if the business has since moved country (§D.2, §M: "a shared PDF never
 * silently changes language").
 *
 * The text says what the document is, what it is for, and — for an invoice
 * with something outstanding — what is still owed. It never says the document
 * was delivered, received or paid unless the ledger says so.
 */

import type { DocumentType, FrozenLabels } from '../domain/documents/types'
import { type LocaleProfile, displayLabels } from '../domain/locale/profile'
import type { Money } from '../domain/money/money'

export interface ShareableDocument {
  readonly type: DocumentType
  readonly reference: string | null
  readonly frozenLabels: FrozenLabels | null
  readonly customerName?: string
  /** Absent on a delivery document, which carries no money (§G, §I, §V). */
  readonly total?: Money
  readonly outstanding?: Money
  readonly dueDate?: string
}

/** The words around the labels, from the caller's language catalogue (§S). */
export interface ShareTextStrings {
  readonly line: string
  readonly forCustomer: string
  readonly totalLine: string
  readonly outstandingLine: string
  readonly dueLine: string
  readonly fromBusiness: string
}

export interface ShareTextInput {
  readonly document: ShareableDocument
  readonly businessName: string
  readonly profile: LocaleProfile
  readonly strings: ShareTextStrings
  readonly formatAmount: (amount: Money) => string
  readonly fill: (template: string, values: Readonly<Record<string, string>>) => string
}

export interface ShareText {
  /** The sheet's title — the document, by its own name. */
  readonly title: string
  readonly body: string
}

export function shareTextFor(input: ShareTextInput): ShareText {
  const { document, strings, fill, formatAmount } = input

  // Frozen labels win where they exist; a draft has none and resolves live.
  // The PRINTED title is the word to use — it is what the customer reads at the
  // top of the document being sent, and it is the one type-name an issued
  // document freezes (§D.2), so the message and the page always agree.
  const labels = displayLabels(input.profile, document.type, document.frozenLabels)
  const reference = document.reference ?? ''

  const title = fill(strings.line, {
    label: sentenceCase(labels.printedTitle, labels.language),
    reference,
  })

  const lines: string[] = [title]

  if (document.customerName !== undefined && document.customerName !== '') {
    lines.push(fill(strings.forCustomer, { customer: document.customerName }))
  }

  if (document.total !== undefined) {
    lines.push(fill(strings.totalLine, { amount: formatAmount(document.total) }))
  }

  // Only when there is genuinely something left — a settled invoice must not
  // go out with a demand attached.
  if (document.outstanding !== undefined && document.outstanding.minor > 0) {
    lines.push(fill(strings.outstandingLine, { amount: formatAmount(document.outstanding) }))
    if (document.dueDate !== undefined) {
      lines.push(fill(strings.dueLine, { due: document.dueDate }))
    }
  }

  lines.push(fill(strings.fromBusiness, { business: input.businessName }))

  return { title, body: lines.join('\n') }
}

/**
 * The printed title is upper case because that is how it prints (§I). A
 * message is not a page: "DELIVERY NOTE WB-0007" shouts at the customer.
 *
 * The frozen WORD is what §D.2 protects, and casing is presentation — so this
 * softens the case and changes nothing else. Scripts without case (Arabic,
 * among the shipped tables) pass through untouched, and the document's own
 * frozen language does the lowering so it follows that language's rules rather
 * than the device's.
 */
export function sentenceCase(title: string, language: string): string {
  const lowered = title.toLocaleLowerCase(language)
  const first = [...lowered][0]
  if (first === undefined) return title
  return first.toLocaleUpperCase(language) + lowered.slice(first.length)
}

/** The filename a shared document carries, once there is a file to attach. */
export function shareFileName(reference: string | null, fallback: string): string {
  const base = (reference ?? fallback).trim().replace(/[^A-Za-z0-9._-]+/g, '-')
  return `${base === '' ? fallback : base}.pdf`
}
