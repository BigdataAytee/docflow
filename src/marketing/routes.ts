/**
 * §T's marketing site: one landing page per document type per language.
 *
 * §T: "A marketing site with a localized landing page per document type per
 * language (e.g. `/invoice-maker`, `/delivery-note`, `/fr/devis`,
 * `/es/cotizacion`): fast, static, `hreflang`-linked, with `schema.org`
 * SoftwareApplication + Offer markup, a sitemap, and store smart-banners."
 *
 * **The slugs are PINNED DATA, not derived — and that is the opposite of the
 * store listing next door.** Decision 159 says a listing follows a renamed
 * type, because a listing is read fresh every time. A URL is not: it is a
 * permanent commitment. Every inbound link, every store campaign parameter,
 * every search result and every share of a landing page points at the string
 * below, so deriving it from the terminology table would mean a reviewer
 * changing a word in one file silently 404s the web and throws away whatever
 * ranking the page had earned.
 *
 * So a rename changes the page's CONTENT (which derives, as everything else
 * does) and never its address. When an address genuinely must change, the old
 * one goes in `previousSlugs` and keeps working as a redirect — a URL that
 * once existed is never simply deleted.
 *
 * The other consequence of pinning: adding a launch locale will not quietly
 * generate seven URLs nobody chose. It fails a test until somebody picks them.
 */

import type { DocumentType } from '../domain/documents/types'
import type { LocaleId } from '../domain/locale/types'

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'invoice',
  'quotation',
  'receipt',
  'waybill',
]

export interface LocaleSite {
  /**
   * The path segment every page of this locale sits under. EN-NG is the home
   * market (§B) and the default locale, so it sits at the root and §T's own
   * `/invoice-maker` example is its invoice page.
   */
  readonly prefix: string
  /**
   * The `hreflang` value. Regional English is the whole reason this is a
   * locale and not a language: §T wants "the UK listing surfacing 'Delivery
   * note', the NG/GH listing 'Waybill'", and `hreflang` is exactly the
   * mechanism that tells a search engine which English to show whom.
   */
  readonly hreflang: string
  readonly slugs: Readonly<Record<DocumentType, string>>
  /** Addresses this locale used to serve. Kept as redirects, never reused. */
  readonly previousSlugs?: Readonly<Record<string, string>>
}

/**
 * Arabic pages carry Arabic content at ASCII addresses.
 *
 * A percent-encoded Arabic URL is legal and unreadable: shared in WhatsApp it
 * arrives as forty characters of `%D9%81`, which is worse for the person
 * receiving it than an English word would be. Flagged for the same reviewer as
 * the terminology table, who may well disagree.
 */
const AR_SLUGS = {
  invoice: 'invoice',
  quotation: 'quotation',
  receipt: 'receipt',
  waybill: 'waybill',
} as const

export const LOCALE_SITES: Readonly<Record<LocaleId, LocaleSite>> = {
  'EN-NG': {
    prefix: '',
    hreflang: 'en-NG',
    slugs: {
      invoice: 'invoice-maker',
      quotation: 'quotation-maker',
      receipt: 'receipt-maker',
      waybill: 'waybill',
    },
  },
  'EN-GH': {
    prefix: 'gh',
    hreflang: 'en-GH',
    slugs: {
      invoice: 'invoice-maker',
      quotation: 'quotation-maker',
      receipt: 'receipt-maker',
      waybill: 'waybill',
    },
  },
  'EN-GB': {
    prefix: 'gb',
    hreflang: 'en-GB',
    slugs: {
      invoice: 'invoice-maker',
      quotation: 'quotation-maker',
      receipt: 'receipt-maker',
      // §T names this page by this address.
      waybill: 'delivery-note',
    },
  },
  'EN-US': {
    prefix: 'us',
    hreflang: 'en-US',
    slugs: {
      invoice: 'invoice-maker',
      // §T: "the US listing 'Estimate & Packing slip'".
      quotation: 'estimate-maker',
      receipt: 'receipt-maker',
      waybill: 'packing-slip',
    },
  },
  FR: {
    prefix: 'fr',
    hreflang: 'fr',
    slugs: {
      invoice: 'facture',
      // §T's own example: /fr/devis.
      quotation: 'devis',
      receipt: 'recu',
      waybill: 'bon-de-livraison',
    },
  },
  ES: {
    prefix: 'es',
    hreflang: 'es',
    slugs: {
      invoice: 'factura',
      // §T's own example: /es/cotizacion.
      quotation: 'cotizacion',
      receipt: 'recibo',
      waybill: 'nota-de-entrega',
    },
  },
  AR: { prefix: 'ar', hreflang: 'ar', slugs: AR_SLUGS },
}

/** The locale a searcher with no better signal lands on: `hreflang="x-default"`. */
export const X_DEFAULT_LOCALE: LocaleId = 'EN-NG'

export interface MarketingRoute {
  readonly locale: LocaleId
  readonly type: DocumentType
  /** Root-relative, always leading-slash, never trailing. */
  readonly path: string
  readonly hreflang: string
}

const joinPath = (...segments: string[]): string =>
  `/${segments.filter((segment) => segment !== '').join('/')}`

export function pathFor(locale: LocaleId, type: DocumentType): string | undefined {
  const site = LOCALE_SITES[locale]
  if (site === undefined) return undefined
  return joinPath(site.prefix, site.slugs[type])
}

/** Every landing page, in a stable order. */
export function marketingRoutes(locales: readonly LocaleId[]): readonly MarketingRoute[] {
  const routes: MarketingRoute[] = []
  for (const locale of locales) {
    const site = LOCALE_SITES[locale]
    if (site === undefined) continue
    for (const type of DOCUMENT_TYPES) {
      routes.push({
        locale,
        type,
        path: joinPath(site.prefix, site.slugs[type]),
        hreflang: site.hreflang,
      })
    }
  }
  return routes
}

/**
 * The `hreflang` cluster for one page: every other locale's page FOR THE SAME
 * DOCUMENT TYPE, plus itself, plus `x-default`.
 *
 * Two rules that a hand-written `<link>` block gets wrong and this cannot:
 *
 * · **The set is reciprocal and includes the page itself.** A cluster that
 *   omits its own page, or that A links to B without B linking back, is
 *   ignored outright rather than partially honoured.
 * · **It groups by TYPE, not by position.** The quotation page must point at
 *   the other locales' quotation pages — `/fr/devis`, not `/fr/facture` — and
 *   the two are neither the same slug nor the same index in any list.
 */
export function alternatesFor(
  type: DocumentType,
  locales: readonly LocaleId[],
): readonly { hreflang: string; path: string }[] {
  const alternates = locales.flatMap((locale) => {
    const site = LOCALE_SITES[locale]
    const path = pathFor(locale, type)
    return site === undefined || path === undefined
      ? []
      : [{ hreflang: site.hreflang, path }]
  })

  const fallback = pathFor(X_DEFAULT_LOCALE, type)
  return fallback === undefined
    ? alternates
    : [...alternates, { hreflang: 'x-default', path: fallback }]
}

/** Old address → the address that replaced it. Permanent redirects. */
export function redirects(
  locales: readonly LocaleId[],
  sites: Readonly<Record<LocaleId, LocaleSite>> = LOCALE_SITES,
): Readonly<Record<string, string>> {
  const map: Record<string, string> = {}
  for (const locale of locales) {
    const site = sites[locale]
    if (site?.previousSlugs === undefined) continue
    for (const [was, now] of Object.entries(site.previousSlugs)) {
      map[joinPath(site.prefix, was)] = joinPath(site.prefix, now)
    }
  }
  return map
}

/**
 * Everything wrong with a set of routes, as data.
 *
 * These checks live in the code rather than in a test, because a test can only
 * assert them about the table that exists today. As a function they also hold
 * for the table somebody writes next year, and a fixture can prove they bite.
 *
 * Two of the three are about redirects, which is where this kind of table
 * rots: a retired address that is also a live page is either a redirect loop
 * or a page shadowed by its own history, and a redirect pointing at an address
 * that no longer exists is a 404 with extra steps.
 */
export function routeProblems(
  locales: readonly LocaleId[],
  sites: Readonly<Record<LocaleId, LocaleSite>> = LOCALE_SITES,
): readonly string[] {
  const problems: string[] = []
  const live = new Map<string, string>()

  for (const locale of locales) {
    const site = sites[locale]
    if (site === undefined) {
      problems.push(`${locale} is a launch locale with no site entry`)
      continue
    }
    for (const type of DOCUMENT_TYPES) {
      const slug = site.slugs[type]
      if (slug === undefined || slug === '') {
        problems.push(`${locale}/${type} has no slug`)
        continue
      }
      const path = joinPath(site.prefix, slug)
      const taken = live.get(path)
      if (taken !== undefined) problems.push(`${path} is served by both ${taken} and ${locale}/${type}`)
      else live.set(path, `${locale}/${type}`)
    }
  }

  for (const [was, now] of Object.entries(redirects(locales, sites))) {
    if (live.has(was)) problems.push(`${was} is both a redirect source and a live page`)
    if (!live.has(now)) problems.push(`${was} redirects to ${now}, which is not a page`)
  }

  return problems
}
