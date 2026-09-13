/**
 * The route table, tested for the property that makes it PINNED rather than
 * derived: a renamed document type must not move a published URL.
 *
 * This is the exact inverse of the store listing next door (decision 159),
 * and the reason is the difference between the two surfaces. A listing is read
 * fresh every time, so it must follow a rename. A URL is a permanent
 * commitment — every inbound link, every store campaign parameter, every
 * search result and every share points at it — so it must not.
 */

import { describe, expect, it } from 'vitest'

import { EN_NG, LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { APP_PATH_PREFIXES } from './sitemap'
import {
  DOCUMENT_TYPES,
  LOCALE_SITES,
  type LocaleSite,
  X_DEFAULT_LOCALE,
  alternatesFor,
  marketingRoutes,
  pathFor,
  redirects,
  routeProblems,
} from './routes'

const ROUTES = marketingRoutes(LAUNCH_LOCALES)

const site = (locale: string): LocaleSite => {
  const entry = LOCALE_SITES[locale]
  if (entry === undefined) throw new Error(`no site for ${locale}`)
  return entry
}

describe('Every launch locale has chosen its addresses (§T)', () => {
  it('has a pinned slug for every locale and every type', () => {
    // Adding a launch locale must not quietly generate four URLs nobody
    // chose. It fails here until somebody picks them.
    for (const locale of LAUNCH_LOCALES) {
      const site = LOCALE_SITES[locale]
      expect(site, `${locale} has no site entry`).toBeDefined()
      for (const type of DOCUMENT_TYPES) {
        expect(site?.slugs[type], `${locale}/${type} has no slug`).toBeTruthy()
      }
    }
    expect(ROUTES).toHaveLength(LAUNCH_LOCALES.length * DOCUMENT_TYPES.length)
  })

  it('serves §T’s own published addresses', () => {
    // §T: "e.g. /invoice-maker, /delivery-note, /fr/devis, /es/cotizacion".
    expect(pathFor('EN-NG', 'invoice')).toBe('/invoice-maker')
    expect(pathFor('FR', 'quotation')).toBe('/fr/devis')
    expect(pathFor('ES', 'quotation')).toBe('/es/cotizacion')
    // §T's /delivery-note is the British page; regional English is the whole
    // reason these are locales rather than languages, and EN-NG holds the
    // root because it is the home market (§B).
    expect(pathFor('EN-GB', 'waybill')).toBe('/gb/delivery-note')
    expect(pathFor('EN-NG', 'waybill')).toBe('/waybill')
  })

  it('gives no two pages the same address', () => {
    const paths = ROUTES.map((route) => route.path)
    expect(new Set(paths).size, 'two pages share a path').toBe(paths.length)
  })

  it('uses addresses that survive being pasted into a chat', () => {
    for (const route of ROUTES) {
      expect(route.path, `${route.locale}/${route.type}`).toMatch(/^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/)
      expect(route.path).not.toMatch(/--|\/-|-\//)
    }
  })

  it('never puts a marketing page under an app or public prefix', () => {
    // A marketing page at /d/… would be crawlable at an address the app also
    // serves, and the §P boundary is drawn by prefix.
    for (const route of ROUTES) {
      for (const prefix of APP_PATH_PREFIXES) {
        expect(
          route.path.startsWith(prefix),
          `${route.path} collides with the app prefix ${prefix}`,
        ).toBe(false)
      }
    }
  })
})

describe('A rename changes the words, never the address', () => {
  it('keeps the URL when the terminology table renames the type', () => {
    const before = pathFor('EN-NG', 'waybill')

    // The rename that would happen: a reviewer decides Nigeria types it as
    // two words. Every heading in the app follows. The URL must not.
    const renamed = {
      ...EN_NG,
      types: {
        ...EN_NG.types,
        waybill: { ...EN_NG.types.waybill, label: 'Way bill', pluralLabel: 'Way bills' },
      },
    }
    expect(renamed.types.waybill.label).not.toBe(EN_NG.types.waybill.label)

    // Nothing in the route table consults the terminology table at all — which
    // is the point, and is why this assertion can be this blunt.
    expect(pathFor('EN-NG', 'waybill')).toBe(before)
  })

  it('has nothing wrong with the table as it stands', () => {
    expect(routeProblems(LAUNCH_LOCALES)).toEqual([])
  })

  it('catches a retired address that is still a live page', () => {
    // No address has been retired yet, so the guard is proved against a
    // fixture rather than against an empty map — a check that runs over
    // nothing passes for the wrong reason and keeps passing when it breaks.
    const shadowed = {
      ...LOCALE_SITES,
      'EN-NG': {
        ...site('EN-NG'),
        // "waybill" is a LIVE page; retiring it to point at itself is the
        // loop this catches.
        previousSlugs: { waybill: 'waybill' },
      },
    }

    expect(routeProblems(LAUNCH_LOCALES, shadowed)).toContain(
      '/waybill is both a redirect source and a live page',
    )
  })

  it('catches a redirect pointing at a page that does not exist', () => {
    const dangling = {
      ...LOCALE_SITES,
      FR: { ...site('FR'), previousSlugs: { 'ancien-devis': 'devis-2019' } },
    }

    expect(routeProblems(LAUNCH_LOCALES, dangling)).toContain(
      '/fr/ancien-devis redirects to /fr/devis-2019, which is not a page',
    )
  })

  it('accepts a retired address that points at a live page', () => {
    const proper = {
      ...LOCALE_SITES,
      FR: { ...site('FR'), previousSlugs: { 'ancien-devis': 'devis' } },
    }

    expect(routeProblems(LAUNCH_LOCALES, proper)).toEqual([])
    expect(redirects(LAUNCH_LOCALES, proper)['/fr/ancien-devis']).toBe('/fr/devis')
  })

  it('catches two locales claiming one address', () => {
    const collided = {
      ...LOCALE_SITES,
      'EN-GH': { ...site('EN-GH'), prefix: '' },
    }

    expect(routeProblems(LAUNCH_LOCALES, collided).join(' ')).toContain('is served by both')
  })
})

describe('hreflang is reciprocal, self-inclusive and grouped by type', () => {
  it('includes the page itself in its own cluster', () => {
    for (const route of ROUTES) {
      const cluster = alternatesFor(route.type, LAUNCH_LOCALES)
      expect(
        cluster.some((alt) => alt.path === route.path && alt.hreflang === route.hreflang),
        `${route.path} is missing from its own hreflang cluster`,
      ).toBe(true)
    }
  })

  it('gives every page of a type the IDENTICAL cluster', () => {
    // This is what reciprocity IS here, and asserting it directly beats
    // asking each page whether the others link back — which, when the cluster
    // is computed from the type alone, is a question that answers itself.
    for (const type of DOCUMENT_TYPES) {
      const cluster = alternatesFor(type, LAUNCH_LOCALES)
      const pages = ROUTES.filter((route) => route.type === type)
      expect(pages.length).toBe(LAUNCH_LOCALES.length)

      for (const page of pages) {
        expect(
          alternatesFor(page.type, LAUNCH_LOCALES),
          `${page.path} has a different cluster from its siblings`,
        ).toEqual(cluster)
      }
      // And every sibling is in it, which is the half a one-way <link> block
      // gets wrong.
      for (const page of pages) {
        expect(cluster.some((alt) => alt.path === page.path)).toBe(true)
      }
    }
  })

  it('groups by document type, not by position', () => {
    // The quotation page must point at the other locales' QUOTATION pages.
    // /fr/devis and /fr/facture are neither the same slug nor the same index.
    const cluster = alternatesFor('quotation', LAUNCH_LOCALES).map((alt) => alt.path)

    expect(cluster).toContain('/fr/devis')
    expect(cluster).toContain('/es/cotizacion')
    expect(cluster).not.toContain('/fr/facture')
    expect(cluster).not.toContain('/es/factura')
  })

  it('names one x-default, and it is the home market', () => {
    for (const type of DOCUMENT_TYPES) {
      const cluster = alternatesFor(type, LAUNCH_LOCALES)
      const defaults = cluster.filter((alt) => alt.hreflang === 'x-default')

      expect(defaults).toHaveLength(1)
      expect(defaults[0]?.path).toBe(pathFor(X_DEFAULT_LOCALE, type))
    }
  })

  it('gives every locale a distinct hreflang code', () => {
    const codes = LAUNCH_LOCALES.map((locale) => LOCALE_SITES[locale]?.hreflang)

    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) {
      expect(code, 'not a language or language-region code').toMatch(/^[a-z]{2}(-[A-Z]{2})?$/)
    }
  })

  it('matches the language each terminology table is actually written in', () => {
    for (const locale of LAUNCH_LOCALES) {
      const table = TERMINOLOGY_TABLES[locale]
      const site = LOCALE_SITES[locale]
      if (table === undefined || site === undefined) continue
      expect(
        site.hreflang.split('-')[0],
        `${locale} is served as ${site.hreflang} but written in ${table.language}`,
      ).toBe(table.language)
    }
  })
})
