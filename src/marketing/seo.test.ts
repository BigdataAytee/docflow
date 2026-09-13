/**
 * The head of a landing page, and the boundary that keeps customer documents
 * out of a search index (§T).
 */

import { describe, expect, it } from 'vitest'

import { EN_GB, EN_NG, FR, LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { hasCopyFor } from './copy'
import { DOCUMENT_TYPES, marketingRoutes, pathFor } from './routes'
import { MARKETING_ROBOTS, SITE_ORIGIN, absolute, headFor, jsonLdFor } from './seo'
import { APP_PATH_PREFIXES, robotsTxt, sitemapXml } from './sitemap'

const head = (table = EN_NG, locale = 'EN-NG', type: 'invoice' | 'waybill' = 'invoice') => {
  const value = headFor(table, locale, type, LAUNCH_LOCALES)
  if (value === undefined) throw new Error('no head')
  return value
}

describe('The page derives its words and pins its address', () => {
  it('says the locale’s own word for the type', () => {
    const ng = head(EN_NG, 'EN-NG', 'waybill')
    const gb = head(EN_GB, 'EN-GB', 'waybill')

    expect(ng.title).toContain(EN_NG.types.waybill.label)
    expect(gb.title).toContain(EN_GB.types.waybill.label)
    expect(ng.title).not.toEqual(gb.title)
  })

  it('follows a rename in the words while the address stands still', () => {
    const renamed = {
      ...EN_NG,
      types: { ...EN_NG.types, waybill: { ...EN_NG.types.waybill, label: 'Way bill' } },
    }
    const before = head(EN_NG, 'EN-NG', 'waybill')
    const after = head(renamed, 'EN-NG', 'waybill')

    expect(after.title).toContain('Way bill')
    expect(after.title).not.toEqual(before.title)
    expect(after.path).toBe(before.path)
    expect(after.canonical).toBe(before.canonical)
  })

  it('carries the language and direction the table declares', () => {
    expect(head(EN_NG, 'EN-NG').lang).toBe('en')
    expect(head(EN_NG, 'EN-NG').dir).toBe('ltr')
  })

  it('builds no head at all for a language with no marketing copy', () => {
    // §S, and `strings.ts` before it: absent beats English under a French
    // flag. There is no French copy, so there is no French page — not a
    // French-flagged English one.
    expect(headFor(FR, 'FR', 'invoice', LAUNCH_LOCALES)).toBeUndefined()
    const ar = TERMINOLOGY_TABLES['AR']
    if (ar !== undefined) expect(headFor(ar, 'AR', 'invoice', LAUNCH_LOCALES)).toBeUndefined()
  })
})

describe('Canonical and hreflang do not fight each other', () => {
  it('points every canonical at the page itself', () => {
    for (const route of marketingRoutes(LAUNCH_LOCALES)) {
      const table = TERMINOLOGY_TABLES[route.locale]
      if (table === undefined || !hasCopyFor(table.language)) continue
      const page = headFor(table, route.locale, route.type, LAUNCH_LOCALES)

      expect(page?.canonical).toBe(absolute(route.path))
    }
  })

  it('never canonicalises one locale onto another', () => {
    // EN-GH and EN-NG ship identical vocabulary, which is exactly when
    // somebody reaches for a cross-locale canonical to "fix duplicate
    // content". It would delete the EN-GH page from the index and take its
    // hreflang cluster with it; self-canonical plus hreflang is the pair that
    // actually handles regional duplicates.
    const gh = TERMINOLOGY_TABLES['EN-GH']
    if (gh === undefined) throw new Error('no EN-GH table')
    const page = headFor(gh, 'EN-GH', 'invoice', LAUNCH_LOCALES)

    expect(page?.canonical).toBe(absolute('/gh/invoice-maker'))
    expect(page?.canonical).not.toBe(absolute('/invoice-maker'))
  })

  it('gives absolute hrefs, because relative hreflang is ignored', () => {
    for (const alternate of head().alternates) {
      expect(alternate.href.startsWith(`${SITE_ORIGIN}/`)).toBe(true)
    }
  })
})

describe('The structured data claims nothing untrue (§T, §U)', () => {
  it('is valid JSON describing a SoftwareApplication with an Offer', () => {
    const data = JSON.parse(jsonLdFor(EN_NG, 'invoice', EN_NG.types.invoice.label)) as Record<
      string,
      unknown
    >

    expect(data['@type']).toBe('SoftwareApplication')
    expect((data['offers'] as Record<string, unknown>)['@type']).toBe('Offer')
    expect((data['offers'] as Record<string, unknown>)['price']).toBe('0')
  })

  it('invents no Pro price, because nobody has set one', () => {
    // §U: "the exact free/Pro line is a product decision recorded in §W before
    // Phase 5". Offer markup is shown to people as fact — the one place a
    // placeholder must never go.
    const raw = jsonLdFor(EN_NG, 'invoice', EN_NG.types.invoice.label)
    const prices = [...raw.matchAll(/"price"\s*:\s*"([^"]*)"/g)].map((match) => match[1])

    expect(prices).toEqual(['0'])
  })

  it('cannot break out of its own script tag', () => {
    // JSON.stringify does not escape `<`, so a label containing `</script>`
    // would close the element and hand the rest of the document to the HTML
    // parser. Caught by the page-escaping test, fixed here at the source.
    const hostile = {
      ...EN_NG,
      types: {
        ...EN_NG.types,
        invoice: { ...EN_NG.types.invoice, label: '</script><img src=x onerror=alert(1)>' },
      },
    }
    const raw = jsonLdFor(hostile, 'invoice', hostile.types.invoice.label)

    expect(raw).not.toContain('</script>')
    expect(raw).not.toContain('<img')
    // Still valid JSON, and still the same string once parsed.
    const parsed = JSON.parse(raw) as { featureList: string[] }
    expect(parsed.featureList).toContain('</script><img src=x onerror=alert(1)>')
  })

  it('invents no ratings', () => {
    const raw = jsonLdFor(EN_NG, 'invoice', EN_NG.types.invoice.label)

    expect(raw).not.toContain('aggregateRating')
    expect(raw).not.toContain('reviewCount')
  })

  it('says the free tier honestly, per Rule #6', () => {
    const raw = jsonLdFor(EN_NG, 'invoice', EN_NG.types.invoice.label)

    expect(raw).toContain('never locked')
    expect(raw).toContain('export is free forever')
  })
})

describe('Only marketing pages are crawlable (§T, §P)', () => {
  it('marks marketing pages index, follow — and nothing else does', () => {
    expect(head().robots).toBe(MARKETING_ROBOTS)
    expect(MARKETING_ROBOTS).toBe('index, follow')
  })

  it('puts no app or public path in the sitemap', () => {
    const xml = sitemapXml(LAUNCH_LOCALES)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')

    expect(locs.length).toBeGreaterThan(0)
    for (const loc of locs) {
      const path = loc.slice(SITE_ORIGIN.length)
      for (const prefix of APP_PATH_PREFIXES) {
        expect(path.startsWith(prefix), `${loc} is a customer-facing path`).toBe(false)
      }
    }
  })

  it('contains exactly the marketing routes, because it is built by inclusion', () => {
    // A sitemap built by walking a directory and filtering is one forgotten
    // rule away from publishing an invoice. This one cannot contain a page
    // nobody put in the route table.
    const xml = sitemapXml(LAUNCH_LOCALES)
    const locs = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? ''),
    )
    const expected = new Set(marketingRoutes(LAUNCH_LOCALES).map((r) => absolute(r.path)))

    expect(locs).toEqual(expected)
  })

  it('carries the same hreflang cluster the pages carry', () => {
    // A crawler that finds the pages by sitemap and one that finds them by
    // crawling must be told the same thing; disagreeing is worse than silence.
    const xml = sitemapXml(LAUNCH_LOCALES)

    for (const type of DOCUMENT_TYPES) {
      const path = pathFor('FR', type)
      if (path === undefined) continue
      expect(xml).toContain(`hreflang="fr" href="${absolute(path)}"`)
    }
    expect(xml).toContain('hreflang="x-default"')
  })

  it('disallows the public document paths in robots.txt as well', () => {
    // Disallow and noindex fail in opposite directions: noindex needs the
    // crawler to fetch the page, and the thing that must not be indexed is
    // the token in the URL. §P gets both.
    const text = robotsTxt()

    for (const prefix of APP_PATH_PREFIXES) expect(text).toContain(`Disallow: ${prefix}`)
    expect(text).toContain(`Sitemap: ${absolute('/sitemap.xml')}`)
  })

  it('escapes what it puts in XML', () => {
    const xml = sitemapXml(LAUNCH_LOCALES)

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    // No raw ampersand anywhere: every one must be an entity.
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })
})
