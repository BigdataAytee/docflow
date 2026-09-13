/**
 * What goes in the head of a landing page (§T Web SEO).
 *
 * §T asks for `hreflang` links, `schema.org` SoftwareApplication + Offer
 * markup, and a hard privacy boundary: "public signing/acceptance pages (§P)
 * are `noindex, nofollow` and excluded from the sitemap — customer documents
 * must never enter a search index. **Only marketing pages are crawlable.**"
 *
 * The addresses come from the pinned route table; everything a reader SEES
 * comes from the §D terminology table, so the page says "Waybill" in Lagos and
 * "Delivery note" in Manchester without either word being typed here (Rule 4).
 */

import type { DocumentType } from '../domain/documents/types'
import type { LocaleId, TerminologyTable } from '../domain/locale/types'
import { copyFor, renderCopy } from './copy'
import { alternatesFor, pathFor } from './routes'

/** Where the marketing site lives (§Q: webdocflow.com points here at cutover). */
export const SITE_ORIGIN = 'https://www.docflow.app'

export const absolute = (path: string): string => `${SITE_ORIGIN}${path}`

export interface PageHead {
  readonly path: string
  readonly lang: string
  readonly dir: 'ltr' | 'rtl'
  readonly title: string
  readonly description: string
  /** Self-referencing. Never points at another locale — that would undo hreflang. */
  readonly canonical: string
  readonly alternates: readonly { hreflang: string; href: string }[]
  readonly robots: string
  /** SoftwareApplication + Offer, ready to drop into a script tag. */
  readonly jsonLd: string
}

/**
 * The Offer states the FREE tier and nothing else.
 *
 * §U: Free is "the honest core, forever", and "the exact free/Pro line is a
 * product decision recorded in §W **before Phase 5**". Nobody has made it. A
 * price in this markup would be a number invented to fill a field — and
 * schema.org Offer markup is read by search engines and shown to people as if
 * it were a fact, which is the one place a placeholder must never go.
 */
function offer(): Record<string, unknown> {
  return {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    // Rule #6: existing documents are never held hostage, so the thing being
    // offered at zero is the whole core, not a trial of it.
    description:
      'Create and issue documents of all four types, with customers, payments, ' +
      'receipts, PDF export and sharing. Free forever. Existing documents are ' +
      'never locked, and export is free forever.',
  }
}

/**
 * SoftwareApplication markup.
 *
 * No `aggregateRating`: there are no ratings, and inventing one is both a
 * schema.org violation and the kind of fabricated social proof §T rules out in
 * the same breath as fake reviews.
 */
export function jsonLdFor(table: TerminologyTable, type: DocumentType, name: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'DocFlow',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Android, iOS, Web',
    inLanguage: table.language,
    description: wordsFor(table, type)?.description ?? '',
    featureList: [name, ...Object.values(table.types).map((t) => t.label)].filter(
      (value, index, all) => all.indexOf(value) === index,
    ),
    offers: offer(),
  }
  return jsonForScriptTag(data)
}

/**
 * JSON that is safe to drop between `<script>` tags.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>`
 * closes the element and everything after it is parsed as HTML — the classic
 * JSON-LD breakout, and the reason this page's own escaping test caught it.
 * Escaping `<` as `\u003c` is still valid JSON, parses to the same string, and
 * cannot end an element. `&` goes too, so the text survives an HTML-entity
 * decoding pass unchanged.
 */
export function jsonForScriptTag(data: unknown): string {
  return JSON.stringify(data, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}

/**
 * The page's own words: the sentence from the language's copy catalogue, the
 * nouns from the region's terminology table.
 *
 * Both halves are looked up independently, which is §S's rule — "a
 * French-speaking business in Lagos gets FR strings with EN-NG terminology" —
 * and is why this returns `undefined` for a language with no copy rather than
 * falling back to English.
 */
export function wordsFor(
  table: TerminologyTable,
  type: DocumentType,
): { title: string; description: string } | undefined {
  const copy = copyFor(table.language)
  if (copy === undefined) return undefined
  const term = table.types[type]
  return renderCopy(copy, {
    label: term.label,
    labelLower: term.label.toLowerCase(),
    plural: term.pluralLabel,
  })
}

/**
 * Marketing pages are `index, follow`. They are the ONLY pages that are.
 *
 * The boundary is stated as a positive here rather than as an exception
 * somewhere else, so that a new page is not crawlable by default: anything
 * that is not in this route table never gets these headers at all, and the
 * signing and acceptance pages set `noindex, nofollow` themselves (§P).
 */
export const MARKETING_ROBOTS = 'index, follow'

export function headFor(
  table: TerminologyTable,
  locale: LocaleId,
  type: DocumentType,
  locales: readonly LocaleId[],
): PageHead | undefined {
  const path = pathFor(locale, type)
  const words = wordsFor(table, type)
  // No copy, no page. An English sentence under a French flag is the thing
  // §S rules out, and it is the first thing a French searcher would read.
  if (path === undefined || words === undefined) return undefined

  return {
    path,
    lang: table.language,
    dir: table.direction,
    title: words.title,
    description: words.description,
    canonical: absolute(path),
    alternates: alternatesFor(type, locales).map((alternate) => ({
      hreflang: alternate.hreflang,
      href: absolute(alternate.path),
    })),
    robots: MARKETING_ROBOTS,
    jsonLd: jsonLdFor(table, type, table.types[type].label),
  }
}
