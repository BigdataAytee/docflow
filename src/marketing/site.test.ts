/**
 * The site as it would actually be published.
 *
 * The tests that matter here are the ones about what must NOT come out: an
 * unreviewed locale's words, a customer document's address, a smart banner
 * pointing at an app that does not exist.
 */

import { describe, expect, it } from 'vitest'

import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import { TEMPLATES } from '../pdf/templates'
import { hasCopyFor } from './copy'
import { escapeHtml, pageHtml, renderPage } from './page'
import { marketingRoutes } from './routes'
import { SITE_ORIGIN, headFor } from './seo'
import { APP_PATH_PREFIXES } from './sitemap'
import { buildSite, reportOf } from './site'

const SITE = buildSite()

/** The locales that can actually be rendered today: the ones with EN copy. */
const PUBLISHED = LAUNCH_LOCALES.filter((locale) => {
  const table = TERMINOLOGY_TABLES[locale]
  return table !== undefined && hasCopyFor(table.language)
})

const html = (file: string): string => {
  const found = SITE.files.find((entry) => entry.file === file)
  if (found === undefined) throw new Error(`${file} was not published`)
  return found.contents
}

describe('What the site publishes', () => {
  it('publishes a page per PUBLISHABLE locale per type, plus the sitemap and robots', () => {
    const pages = marketingRoutes(PUBLISHED).length

    expect(PUBLISHED.length).toBeLessThan(LAUNCH_LOCALES.length)
    expect(SITE.files).toHaveLength(pages + 2)
    expect(SITE.files.map((f) => f.file)).toContain('sitemap.xml')
    expect(SITE.files.map((f) => f.file)).toContain('robots.txt')
  })

  it('publishes each page at a suffix-free URL', () => {
    // /invoice-maker, not /invoice-maker.html — the address in §T has no
    // extension, and an address is a permanent commitment.
    expect(html('invoice-maker/index.html')).toContain('<html lang="en"')
    expect(html('gb/delivery-note/index.html')).toContain('<html lang="en"')
  })

  it('writes no file outside the site root', () => {
    for (const file of SITE.files) {
      expect(file.file.startsWith('/')).toBe(false)
      expect(file.file).not.toContain('..')
    }
  })
})

describe('What the site refuses to publish', () => {
  it('blocks every locale whose terminology is unreviewed', () => {
    // A landing page is a reader, and CLAUDE.md's rule does not care whether
    // the reader is inside the app.
    expect(SITE.blockers.length).toBeGreaterThan(0)
    // Only the locales that got as far as rendering. The rest are blocked
    // one step earlier, for having no copy at all.
    for (const locale of PUBLISHED) {
      const table = TERMINOLOGY_TABLES[locale]
      if (table === undefined || table.reviewStatus === 'approved') continue
      expect(
        SITE.blockers.some((b) => b.startsWith(`${locale} is ${table.reviewStatus}`)),
        `${locale} was not blocked`,
      ).toBe(true)
    }
    expect(reportOf(SITE)).toContain('NOT publishable')
  })

  it('publishes no page for a language with no marketing copy', () => {
    // The French page used to read "Create a devis on your phone" — an
    // English sentence with a French noun in it. §S already settled this for
    // the app: absent beats English under a French flag.
    const files = SITE.files.map((f) => f.file)

    expect(files).not.toContain('fr/devis/index.html')
    expect(files).not.toContain('es/cotizacion/index.html')
    expect(files).not.toContain('ar/invoice/index.html')
    expect(SITE.blockers.some((b) => b.includes('no fr marketing copy'))).toBe(true)
  })

  it('never names an unpublished locale in an hreflang cluster or the sitemap', () => {
    // A cluster pointing at a page that was never published is a 404
    // advertised to a search engine.
    for (const file of SITE.files) {
      expect(file.contents).not.toContain('hreflang="fr"')
      expect(file.contents).not.toContain('/fr/devis')
      expect(file.contents).not.toContain('hreflang="ar"')
    }
  })

  it('emits no smart banner without a real app id', () => {
    // app-id=0000000000 renders a banner that 404s on tap.
    expect(html('invoice-maker/index.html')).not.toContain('apple-itunes-app')
    expect(SITE.notes.some((n) => n.includes('no App Store id is configured'))).toBe(true)
  })

  it('emits one when there is an app to point at', () => {
    const withApp = buildSite(LAUNCH_LOCALES, { appleAppId: '123456789' })
    const page = withApp.files.find((f) => f.file === 'invoice-maker/index.html')

    expect(page?.contents).toContain('content="app-id=123456789"')
  })

  it('says plainly that deep links are not generated', () => {
    expect(SITE.notes.join(' ')).toContain('Universal Links and App Links are NOT generated')
    expect(SITE.notes.join(' ')).toContain('Team ID')
  })

  it('puts no customer-facing path in any published file', () => {
    for (const file of SITE.files) {
      for (const prefix of APP_PATH_PREFIXES) {
        expect(
          file.contents.includes(`${SITE_ORIGIN}${prefix}`),
          `${file.file} links to ${prefix}`,
        ).toBe(false)
      }
    }
  })
})

describe('The page shows the real product (§T)', () => {
  it('renders the gallery from the sixteen designs the app ships', () => {
    const page = html('invoice-maker/index.html')

    expect(TEMPLATES).toHaveLength(16)
    for (const template of TEMPLATES) {
      expect(page, `${template.name} is missing from the gallery`).toContain(
        escapeHtml(template.name),
      )
      expect(page).toContain(escapeHtml(template.paper))
    }
  })

  it('says the locale’s own word, and only that locale’s', () => {
    const ng = html('waybill/index.html')
    const gb = html('gb/delivery-note/index.html')
    const ngTable = TERMINOLOGY_TABLES['EN-NG']
    const gbTable = TERMINOLOGY_TABLES['EN-GB']
    if (ngTable === undefined || gbTable === undefined) throw new Error('missing table')

    expect(ng).toContain(`<h1>${ngTable.types.waybill.label}</h1>`)
    expect(gb).toContain(`<h1>${gbTable.types.waybill.label}</h1>`)
    expect(ng).not.toContain(`<h1>${gbTable.types.waybill.label}</h1>`)
  })

  it('takes the text direction from the head, not from an assumption', () => {
    // Arabic does not publish today, so RTL is proved against the renderer
    // directly rather than against a page that does not exist.
    expect(html('invoice-maker/index.html')).toContain('dir="ltr"')

    const table = TERMINOLOGY_TABLES['EN-NG']
    if (table === undefined) throw new Error('no table')
    const head = headFor(table, 'EN-NG', 'invoice', PUBLISHED)
    if (head === undefined) throw new Error('no head')

    expect(pageHtml({ ...head, dir: 'rtl' }, table, 'invoice')).toContain('dir="rtl"')
  })

  it('escapes what it interpolates', () => {
    const table = TERMINOLOGY_TABLES['EN-NG']
    if (table === undefined) throw new Error('no table')
    const hostile = {
      ...table,
      types: {
        ...table.types,
        invoice: { ...table.types.invoice, label: '"><script>alert(1)</script>' },
      },
    }
    const page = renderPage(hostile, 'EN-NG', 'invoice', LAUNCH_LOCALES)

    expect(page?.html).not.toContain('<script>alert(1)</script>')
    expect(page?.html).toContain('&lt;script&gt;')
  })

  it('carries the canonical, the cluster and the structured data on every page', () => {
    for (const route of marketingRoutes(PUBLISHED)) {
      const page = html(`${route.path.replace(/^\//, '')}/index.html`)

      expect(page, `${route.path} has no canonical`).toContain('rel="canonical"')
      expect(page, `${route.path} has no x-default`).toContain('hreflang="x-default"')
      expect(page, `${route.path} has no structured data`).toContain(
        'application/ld+json',
      )
    }
  })
})
