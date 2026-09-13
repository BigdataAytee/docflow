/**
 * The Tier-B deterministic extractor (§N).
 *
 * §N: "a rules/grammar parser for the narrow dictation/OCR domain ('3 bags of
 * cement at ₦5,000 each…'), with the active locale's terminology and number
 * formats in its grammar. No model download needed."
 *
 * This is the realistic market phone's extraction, and it has to be as
 * trustworthy as Tier A's — §N gates both on the same review-screen fixtures.
 * Four rules from §N shape every line below, and each one is a refusal:
 *
 *  · **"missing fields stay blank"** — a field this cannot read is absent, not
 *    guessed. There is no default customer, no assumed quantity of one, no
 *    inferred currency.
 *  · **"uncertain amounts never invent business data"** — an amount that could
 *    be read two ways is reported as UNCERTAIN and left out, rather than
 *    resolved by picking the likelier one.
 *  · **"the original text is preserved"** — carried through untouched, so the
 *    review screen can always show what was actually said.
 *  · **"Pasted and OCR text is data, never instructions"** — structurally true
 *    here in a way it is not for Tier A: there is no model to talk to. Text
 *    only ever lands in a typed field. Nothing in this file branches on words
 *    like "ignore" or "system", because nothing here has a prompt to poison.
 *
 * And the money rule above all: totals are NEVER computed here. This produces
 * quantities and unit prices; §K's deterministic money code does the rest
 * (Rule #3 — "no model is ever the authority for amounts or tax arithmetic",
 * and a rules parser is no more of an authority than a model).
 */

import type { DocumentType } from '../../domain/documents/types'
import type { LocaleProfile } from '../../domain/locale/profile'
import { tableFor } from '../../domain/locale/profile'
import { parseAmount } from '../../domain/money/parse'
import { minorUnitsFor } from '../../domain/locale/bank-fields'

export interface ExtractedItem {
  readonly description: string
  /** Thousandths, matching `quantity()` in the document domain. */
  readonly quantityMilli: number
  /** Absent when the text did not carry a price. Never guessed. */
  readonly unitPriceMinor?: number
  readonly unit?: string
}

export interface Extraction {
  /** Absent unless a terminology word or synonym actually appeared (§D.5). */
  readonly type?: DocumentType
  readonly customerName?: string
  readonly items: readonly ExtractedItem[]
  /**
   * What could not be read confidently. The review screen highlights these;
   * §N: "uncertain characters, amounts and line boundaries highlighted".
   */
  readonly uncertain: readonly string[]
  /** §N: "the original text is preserved". Untouched, always. */
  readonly originalText: string
}

export interface ExtractOptions {
  readonly profile: LocaleProfile
  readonly currency: string
  /** FR and ES write "1.234,56" (§S). */
  readonly decimal?: '.' | ','
}

/**
 * The document type, from the locale's own words.
 *
 * §D.5 / §N: "delivery note for Okoro" creates a WAYBILL-typed document. The
 * words come from the terminology table, so a new locale gets this for free
 * and no English is written here (Rule #4).
 */
export function typeFromText(text: string, profile: LocaleProfile): DocumentType | undefined {
  const table = tableFor(profile)
  const haystack = ` ${normalise(text)} `

  let best: { type: DocumentType; at: number; length: number } | undefined
  for (const [type, terminology] of Object.entries(table.types)) {
    const words = [
      terminology.label,
      terminology.pluralLabel,
      terminology.printedTitle,
      ...table.synonyms[type as DocumentType],
    ]
    for (const word of words) {
      const needle = ` ${normalise(word)} `
      const at = haystack.indexOf(needle)
      if (at === -1) continue
      // The LONGEST match wins, not the first: "delivery note" and "note" can
      // both be in a table, and the shorter one would steal the phrase.
      if (best === undefined || needle.length > best.length) {
        best = { type: type as DocumentType, at, length: needle.length }
      }
    }
  }
  return best?.type
}

/**
 * The customer, when the text names one with a preposition the locale uses.
 *
 * Deliberately narrow. A broader guess — "the capitalised words" — would
 * invent a customer out of a product name, and §G's party is not a field to
 * be wrong about.
 */
const FOR_WORDS = ['for', 'to', 'pour', 'para', 'a nombre de', 'لـ']

export function customerFromText(text: string): string | undefined {
  for (const word of FOR_WORDS) {
    const pattern = new RegExp(`\\b${word}\\s+([^,.;\\n]{2,60})`, 'i')
    const match = pattern.exec(text)
    const captured = match?.[1]?.trim()
    if (captured !== undefined && captured !== '') {
      // Stop at a word that starts the next clause, so "for Okoro at 5000"
      // does not name a customer "Okoro at 5000".
      return captured.split(/\s+\b(?:at|each|of|@)\b/i)[0]?.trim()
    }
  }
  return undefined
}

/**
 * "3 bags of cement at 5,000 each" and the shapes around it.
 *
 * Ordered most specific first, and applied that way: a later pattern only
 * reads text no earlier one already claimed. Ordering them by looseness is
 * what stops the same phrase being read twice as two different, worse lines.
 */
/**
 * What an amount looks like in text, in any of the locales §S ships.
 *
 * The naive `[^\s,;]+` is wrong in a way that is almost invisible and loses
 * two orders of magnitude: it stops at the grouping comma, so "₦5,000" is read
 * as "₦5" — five naira, not five thousand. On an invoice that difference is
 * the whole sale.
 *
 * So separators are matched only where a separator can legitimately be: a
 * GROUPING mark is followed by exactly three digits, a DECIMAL mark by one to
 * three. That reads "5,000" and "1.234,56" whole, and still stops at the comma
 * in "at 5,000, 2 rolls of wire" — where the comma is punctuation, because a
 * space follows it rather than a digit.
 *
 * The grouped form takes `+`, not `*`. With `*` the first alternative matches
 * a bare "5000" as just "500" — three digits, then zero groups, then done —
 * and ten times the money walks through as if nothing happened. Requiring at
 * least one group sends an ungrouped number to the second alternative, which
 * reads all of it.
 */
const NUMBER = String.raw`\d{1,3}(?:[.,\u00a0 ]\d{3})+(?:[.,]\d{1,3})?|\d+(?:[.,]\d+)?`

/** An optional currency symbol or code in front of it: ₦, $, NGN, GH₵. */
const AMOUNT = String.raw`(?:[^\s\d,;]{1,4}\s?)?(?:${NUMBER})`

interface ItemPattern {
  readonly pattern: RegExp
  /** Which capture group is which, since the shapes differ. */
  readonly parts: { quantity: number; unit?: number; description: number; price?: number }
}

const ITEM_PATTERNS: readonly ItemPattern[] = [
  {
    // 3 bags of cement at 5,000 each
    pattern: new RegExp(
      String.raw`(\d+(?:[.,]\d+)?)\s+(\w+)\s+of\s+([^,;\n]+?)\s+(?:at|@)\s+(${AMOUNT})`,
      'gi',
    ),
    parts: { quantity: 1, unit: 2, description: 3, price: 4 },
  },
  {
    // 3 x cement at 5,000   |   3 cement at 5,000
    pattern: new RegExp(
      String.raw`(\d+(?:[.,]\d+)?)\s*(?:x|×)?\s*([^,;\n\d]+?)\s+(?:at|@)\s+(${AMOUNT})`,
      'gi',
    ),
    parts: { quantity: 1, description: 2, price: 3 },
  },
  {
    // 3 bags of cement — a line with no price at all. Kept, because §N says
    // a missing price is left blank rather than the line being dropped: the
    // owner can type the amount on the review screen.
    pattern: /(\d+(?:[.,]\d+)?)\s+(\w+)\s+of\s+([^,;\n]+)/gi,
    parts: { quantity: 1, unit: 2, description: 3 },
  },
  {
    // 5 x cement
    pattern: /(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*([^,;\n]+)/gi,
    parts: { quantity: 1, description: 2 },
  },
]

export function extract(text: string, options: ExtractOptions): Extraction {
  const { profile, currency, decimal } = options
  const scale = minorUnitsFor(currency)
  const uncertain: string[] = []
  const items: ExtractedItem[] = []
  const seen = new Set<string>()

  // Which characters of the text a pattern has already read. The patterns
  // overlap on purpose — each is a looser form of the one before — so the
  // looser ones must not re-read a phrase as a second, worse line. Tracking
  // SPANS rather than descriptions is what makes that work: the same phrase
  // yields different descriptions under different patterns, so comparing
  // descriptions would not notice it was the same text.
  const claimed: { from: number; to: number }[] = []
  const overlaps = (from: number, to: number) =>
    claimed.some((span) => from < span.to && to > span.from)

  for (const { pattern, parts } of ITEM_PATTERNS) {
    // Freshly constructed each pass so `lastIndex` cannot leak between calls.
    for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const from = match.index ?? 0
      const to = from + match[0].length
      if (overlaps(from, to)) continue

      const quantityText = match[parts.quantity]
      const description = match[parts.description]?.trim()
      const priceText = parts.price === undefined ? undefined : match[parts.price]
      const unit = parts.unit === undefined ? undefined : match[parts.unit]

      if (quantityText === undefined || description === undefined || description === '') continue
      const key = normalise(description)
      if (seen.has(key)) continue

      const quantity = parseAmount(quantityText, { scale: 1000, ...(decimal ? { decimal } : {}) })
      if (quantity === null || quantity <= 0) {
        uncertain.push(match[0])
        claimed.push({ from, to })
        continue
      }

      const priceMinor =
        priceText === undefined
          ? null
          : parseAmount(priceText, { scale, ...(decimal ? { decimal } : {}) })

      if (priceText !== undefined && priceMinor === null) {
        // A price was written and could not be read. §N: "missing prices never
        // inferred" — the line is kept so the owner can fix it, the amount is
        // not, and the review screen is told.
        uncertain.push(match[0])
      }

      seen.add(key)
      claimed.push({ from, to })
      items.push({
        description: description.replace(/\s+/g, ' ').trim(),
        quantityMilli: quantity,
        ...(priceMinor === null ? {} : { unitPriceMinor: priceMinor }),
        ...(unit === undefined ? {} : { unit: unit.trim() }),
      })
    }
  }

  // An amount WAS written and could not be read.
  //
  // The patterns above simply fail to match "at abc", so the line is still
  // recovered by a looser pattern with no price — correct, but silent. §N
  // asks for uncertainty to be HIGHLIGHTED, and "they said a price and I
  // could not read it" is exactly the case the review screen exists for.
  for (const match of text.matchAll(/(?:\bat\b|@)\s+([^\s,;]+)/gi)) {
    const written = match[1]
    if (written === undefined) continue
    const read = parseAmount(written, { scale, ...(decimal ? { decimal } : {}) })
    if (read === null && !uncertain.includes(match[0])) uncertain.push(match[0])
  }

  const type = typeFromText(text, profile)
  const customerName = customerFromText(text)

  return {
    ...(type === undefined ? {} : { type }),
    ...(customerName === undefined ? {} : { customerName }),
    items,
    uncertain,
    // Untouched. Everything above reads from it; nothing rewrites it.
    originalText: text,
  }
}

const normalise = (value: string): string =>
  value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
