/**
 * §T — the store listing, DERIVED from the §D terminology table.
 *
 * §T: "Localized listing per launch locale, **generated from the terminology
 * tables**", and "a per-locale keyword sheet derived from the terminology
 * synonyms… maintained in the repo beside the terminology tables".
 *
 * Generated, not written. The drafts in `docs/discoverability` are prose, and
 * prose drifts: a reviewer changes "Waybill" to "Way-bill" in the terminology
 * table and the listing still says the old word, in the one place a user reads
 * before installing. CLAUDE.md Rule 4 says a type name resolves ONLY through
 * `src/domain/locale` — a store listing is the outermost surface of the
 * product, so it obeys the same rule as a PDF heading.
 *
 * Nothing here truncates, invents or softens. Where a field will not fit or a
 * table is not signed off, the result carries a BLOCKER and says so, because
 * §T's first word is honesty and §X forbids claiming what has not been proven.
 */

import type { DocumentType } from '../domain/documents/types'
import type { TerminologyTable } from '../domain/locale/types'
import { isReleasable } from '../domain/locale/types'

/**
 * Apple's caps, in CHARACTERS (App Store Connect counts characters, not bytes
 * and not UTF-16 code units). `'…'.length` is code units, which over-counts
 * anything outside the BMP; these are measured with `charactersIn`.
 */
export const APPLE_TITLE_MAX = 30
export const APPLE_SUBTITLE_MAX = 30
export const APPLE_KEYWORD_FIELD_MAX = 100

/**
 * Counting the way a store counts.
 *
 * `String.prototype.length` is UTF-16 code units, so a single character outside
 * the BMP counts as two and a name that fits would be reported as overflowing.
 * Counting code points is right for every alphabet the launch set uses,
 * Arabic included.
 */
export const charactersIn = (value: string): number => [...value].length

/**
 * Never in metadata (§T: "no competitor brand names in metadata"). Matched
 * whole-word and case-insensitively, so "quickbooks" and "QuickBooks" both
 * fail and "bookkeeping" does not.
 */
const COMPETITOR_BRANDS = [
  'quickbooks',
  'zoho',
  'freshbooks',
  'wave',
  'xero',
  'sage',
  'invoice2go',
  'billdu',
  'zipbooks',
  'kashflow',
]

/**
 * The editorial decisions a terminology table cannot make, per locale.
 *
 * Everything here is a judgement about PEOPLE — which two type names a market
 * searches hardest, whether a title reads naturally with a trailing English
 * intent word, how a conjunction joins in this script. None of it is derivable
 * from the terminology table, and none of it is translatable by dictionary, so
 * it is data with a reviewer's name against it rather than logic.
 */
export interface LocaleListingInput {
  /**
   * The two types that lead the title. §T's own examples differ per market:
   * "Invoice & Receipt" in EN, "Facture & Devis" in FR, "Factura y Cotización"
   * in ES — the second slot is whichever type that market searches hardest.
   */
  readonly titleTypes: readonly [DocumentType, DocumentType]
  /** "&", "y", "و" — §T's examples use a different one per locale. */
  readonly conjunction: string
  /**
   * Whether the conjunction takes a space on both sides or only after it.
   * Arabic's "و" is written against the word that follows it.
   */
  readonly conjunctionSpacing: 'both' | 'after'
  /**
   * The trailing intent word, Title Case, where the market's grammar takes one.
   * §T's EN pattern ends in "Maker"; its FR and ES examples end at the type
   * names, so this is absent there rather than translated into a phrase no
   * native speaker would type.
   */
  readonly titleIntent?: string
  /** maker / creator / generator / template / app, lowercase, for the sheets. */
  readonly intents: readonly string[]
  /** offline / small business / PDF, in this market's language. */
  readonly qualifiers: readonly string[]
  /**
   * A reviewer's trim, where §T's pattern does not fit Apple's 30 characters.
   *
   * §T's draft sheet: the field is "trimmed by the reviewer, **not by a
   * script**". So the generator never shortens anything — it reports the
   * overflow, a person decides which words go, and the decision lands here
   * where the next person can see it. The override is then held to the same
   * rules as anything generated, plus one more: it must still carry a local
   * type name, because the type name is the half that must survive.
   */
  readonly titleOverride?: string
  readonly subtitleOverride?: string
}

export type ListingField = 'title' | 'subtitle' | 'keywords' | 'locale'

/** A reason this listing must not be submitted. */
export interface ListingBlocker {
  readonly field: ListingField
  readonly reason: string
}

/**
 * Something a reviewer should see that does not stop a submission.
 *
 * The distinction matters more than it looks. There is always more vocabulary
 * than fits in a hundred characters — that is the nature of the field, not a
 * defect — so counting the overflow as a blocker would make `submittable`
 * unreachable in every locale forever. A signal that is always red is a signal
 * nobody reads, and the one thing this file must not become is a warning
 * people have learned to click past.
 */
export interface ListingNote {
  readonly field: ListingField
  readonly detail: string
}

export interface Listing {
  readonly locale: string
  readonly title: string
  readonly subtitle: string
  /** Apple's keyword field: single words, comma-separated, no spaces. */
  readonly keywordField: string
  /** Play's vocabulary: whole phrases, woven into the long description. */
  readonly playTerms: readonly string[]
  /**
   * Everything standing between this draft and a submission. Empty means the
   * listing is submittable; it never means "good".
   */
  readonly blockers: readonly ListingBlocker[]
  /** Worth a reviewer's attention; never a reason to hold the submission. */
  readonly notes: readonly ListingNote[]
  readonly submittable: boolean
}

/**
 * §T's title pattern — "DocFlow: Invoice & Receipt Maker", localized.
 *
 * The local type names lead and the intent word trails, because that is the
 * half a reviewer cuts when Apple's 30 characters bite: "what survives the
 * trim is the local type name, never the generic half."
 */
export function titleFor(
  table: TerminologyTable,
  input: LocaleListingInput,
  brand = 'DocFlow',
): string {
  const [first, second] = input.titleTypes
  const join =
    input.conjunctionSpacing === 'both'
      ? ` ${input.conjunction} `
      : ` ${input.conjunction}`
  const lead = `${table.types[first].label}${join}${table.types[second].label}`
  // French typography puts a space before a colon; nothing else here does.
  const separator = table.language === 'fr' ? ' : ' : ': '
  const head = `${brand}${separator}${lead}`
  return input.titleIntent === undefined ? head : `${head} ${input.titleIntent}`
}

/**
 * The subtitle carries the type the title could not.
 *
 * §T: "the UK listing surfacing 'Delivery note', the NG/GH listing 'Waybill'".
 * The delivery document is both the strongest differentiator and the word that
 * varies most between markets, and the title has room for two types at most —
 * so it goes here, with "offline", which is the product (Rule #2).
 *
 * Listing every type here instead would overflow 30 characters in every locale
 * and say nothing the title has not already said.
 */
export function subtitleFor(table: TerminologyTable, input: LocaleListingInput): string {
  const carried = new Set<DocumentType>(input.titleTypes)
  const remaining = (['waybill', 'quotation', 'receipt', 'invoice'] as const).filter(
    (type) => !carried.has(type),
  )
  const lead = remaining[0] ?? 'waybill'
  const qualifier = input.qualifiers[0]
  const label = table.types[lead].pluralLabel
  return qualifier === undefined ? label : `${label}, ${qualifier}`
}

/** Words, lowercased, with punctuation and separators removed. */
const wordsIn = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0)

/**
 * Apple's keyword field, built from the terminology SYNONYMS.
 *
 * **Single words, never phrases.** Apple recombines the words in this field
 * into phrases itself, so submitting "delivery note" spends fourteen of a
 * hundred characters on a combination Apple would have formed for free from
 * "delivery" and "note" — and those two words then also combine with every
 * other word in the field. Play is the opposite: it indexes the long
 * description as prose, so whole phrases belong there, which is why the two
 * halves of this file produce different shapes from the same vocabulary.
 *
 * Two more rules, both about not wasting a field capped at 100 characters:
 *
 * · **Nothing already in the title or subtitle.** Apple indexes those
 *   separately, so a word repeated here buys nothing and costs its length.
 * · **Nothing twice.** Repeating a term is keyword stuffing, which §T forbids
 *   outright and which stores penalise.
 *
 * Overflow is REPORTED, never silently dropped: a generator that quietly cut
 * the last three words would hide exactly the decision a reviewer must make.
 */
export function keywordFieldFor(
  table: TerminologyTable,
  input: LocaleListingInput,
  title: string,
  subtitle: string,
): { field: string; dropped: readonly string[] } {
  const indexed = new Set(wordsIn(`${title} ${subtitle}`))
  const seen = new Set<string>()

  /**
   * A source term stays whole or stays out.
   *
   * Apple forms phrases by recombining the field's words, but only from words
   * that are actually there: "small" without "business" recombines into
   * nothing anybody searches and spends five characters saying so. So each
   * term is offered as a GROUP and the fit test is applied to the group, not
   * to its words one at a time.
   */
  const groups: string[][] = []
  const offer = (term: string): void => {
    const words = wordsIn(term).filter((word) => !indexed.has(word) && !seen.has(word))
    if (words.length === 0) return
    for (const word of words) seen.add(word)
    groups.push(words)
  }

  // Order is priority, because the tail is what overflow removes.
  //
  // The qualifiers lead, which looks backwards until you remember what this
  // field is FOR: the title and subtitle already carry the type names, Apple
  // indexes those separately, and every word they carry is excluded above. So
  // the keyword field's job is precisely what the title and subtitle could not
  // say — and §T names "offline", "small business" and "PDF" as required
  // coverage rather than as decoration. The type synonyms that the title did
  // not use follow; the intent words, the most replaceable of the three, last.
  for (const qualifier of input.qualifiers) offer(qualifier)
  for (const type of Object.keys(table.synonyms) as DocumentType[]) {
    for (const synonym of table.synonyms[type]) offer(synonym)
  }
  for (const intent of input.intents) offer(intent)

  const kept: string[] = []
  const dropped: string[] = []
  for (const group of groups) {
    const next = [...kept, ...group].join(',')
    if (charactersIn(next) <= APPLE_KEYWORD_FIELD_MAX) kept.push(...group)
    else dropped.push(...group)
  }

  return { field: kept.join(','), dropped }
}

/** Play's vocabulary: the whole phrases, in the same priority order. */
export function playTermsFor(
  table: TerminologyTable,
  input: LocaleListingInput,
): readonly string[] {
  const seen = new Set<string>()
  const terms: string[] = []
  const offer = (term: string): void => {
    const value = term.trim().toLowerCase()
    if (value === '' || seen.has(value)) return
    seen.add(value)
    terms.push(value)
  }
  for (const type of Object.keys(table.synonyms) as DocumentType[]) {
    for (const synonym of table.synonyms[type]) offer(synonym)
  }
  for (const qualifier of input.qualifiers) offer(qualifier)
  for (const intent of input.intents) offer(intent)
  // Play's order is the writer's reading order, not a budget: the long
  // description has room for all of it, so the type nouns lead as prose would.
  return terms
}

/**
 * Does this text still name one of the locale's document types?
 *
 * Checked against the terminology table, so it stays true when a reviewer
 * renames a type — the whole reason this file derives rather than repeats.
 */
const namesAType = (table: TerminologyTable, value: string): boolean => {
  const haystack = value.toLowerCase()
  return Object.values(table.types).some((type) => haystack.includes(type.label.toLowerCase()))
}

const brandHitsIn = (value: string): string[] => {
  const words = new Set(wordsIn(value))
  return COMPETITOR_BRANDS.filter((brand) => words.has(brand))
}

/**
 * The listing for one locale.
 *
 * It always returns a listing — a draft table still has to be readable, or the
 * native speaker has nothing to review. What it never does is call a listing
 * submittable when it is not.
 */
export function listingFor(table: TerminologyTable, input: LocaleListingInput): Listing {
  const title = input.titleOverride ?? titleFor(table, input)
  const subtitle = input.subtitleOverride ?? subtitleFor(table, input)
  const { field, dropped } = keywordFieldFor(table, input, title, subtitle)

  const blockers: ListingBlocker[] = []

  if (!isReleasable(table)) {
    blockers.push({
      field: 'locale',
      reason:
        `the ${table.locale} terminology table is ${table.reviewStatus}, not approved — ` +
        'CLAUDE.md: never ship a table a native speaker has not signed off',
    })
  }

  // A trim that removed the type name saved characters and lost the listing.
  for (const [field_, value] of [
    ['title', input.titleOverride],
    ['subtitle', input.subtitleOverride],
  ] as const) {
    if (value !== undefined && !namesAType(table, value)) {
      blockers.push({
        field: field_,
        reason:
          `the trimmed ${field_} does not name any ${table.locale} document type — ` +
          'the type name is the half that must survive a trim, never the generic half',
      })
    }
  }

  const titleLength = charactersIn(title)
  if (titleLength > APPLE_TITLE_MAX) {
    blockers.push({
      field: 'title',
      reason:
        `${titleLength} characters, ${APPLE_TITLE_MAX} allowed — a reviewer trims it, ` +
        'and what survives the trim is the local type name, never the generic half',
    })
  }

  const subtitleLength = charactersIn(subtitle)
  if (subtitleLength > APPLE_SUBTITLE_MAX) {
    blockers.push({
      field: 'subtitle',
      reason: `${subtitleLength} characters, ${APPLE_SUBTITLE_MAX} allowed — trimmed by a reviewer`,
    })
  }

  const notes: ListingNote[] = []
  if (dropped.length > 0) {
    notes.push({
      field: 'keywords',
      detail:
        `${dropped.length} words did not fit the ${APPLE_KEYWORD_FIELD_MAX}-character field ` +
        `and are NOT in it: ${dropped.join(', ')}. The subtitle and the Play long ` +
        'description are where they can still be covered.',
    })
  }

  for (const brand of brandHitsIn(`${title} ${subtitle} ${field.replaceAll(',', ' ')}`)) {
    blockers.push({
      field: 'keywords',
      reason: `"${brand}" is a competitor brand name — §T forbids it in metadata`,
    })
  }

  return {
    locale: table.locale,
    title,
    subtitle,
    keywordField: field,
    playTerms: playTermsFor(table, input),
    blockers,
    notes,
    submittable: blockers.length === 0,
  }
}
