/**
 * The whole marketing site as files (§T).
 *
 * One function, so that "what gets published" is a single list somebody can
 * read — and so the sitemap and the pages cannot disagree about which pages
 * exist, because both come from the same route table.
 */

import { LAUNCH_LOCALES, TERMINOLOGY_TABLES } from '../domain/locale/data/terminology'
import type { LocaleId } from '../domain/locale/types'
import { hasCopyFor } from './copy'
import { type StoreIds, renderPage } from './page'
import { marketingRoutes, routeProblems } from './routes'
import { robotsTxt, sitemapXml } from './sitemap'

export interface SiteFile {
  /** Relative to the site root, no leading slash. */
  readonly file: string
  readonly contents: string
}

export interface Site {
  readonly files: readonly SiteFile[]
  /** Anything that would make publishing this wrong. Empty means publishable. */
  readonly blockers: readonly string[]
  /** Worth knowing before publishing; never a reason to hold it. */
  readonly notes: readonly string[]
}

/** `/fr/devis` is published as `fr/devis/index.html`, so the URL has no suffix. */
const fileFor = (path: string): string => `${path.replace(/^\//, '')}/index.html`

export function buildSite(
  locales: readonly LocaleId[] = LAUNCH_LOCALES,
  store: StoreIds = {},
): Site {
  const blockers: string[] = []
  const notes: string[] = []
  const files: SiteFile[] = []

  /**
   * Which locales this site can actually render — and therefore which ones
   * the hreflang clusters and the sitemap are allowed to name.
   *
   * A locale with no marketing copy gets no page (§S: absent beats English
   * under a French flag), so naming it in a cluster would be advertising a
   * 404 to a search engine. Every cluster below is built from THIS list, not
   * from the launch set, which is the only way the two cannot disagree.
   */
  const published = locales.filter((locale) => {
    const table = TERMINOLOGY_TABLES[locale]
    if (table === undefined) {
      blockers.push(`${locale} has no terminology table`)
      return false
    }
    if (!hasCopyFor(table.language)) {
      blockers.push(
        `${locale} has no ${table.language} marketing copy, so it is NOT published — ` +
          'a translator writes it; an English page under its flag is not a substitute',
      )
      return false
    }
    return true
  })

  blockers.push(...routeProblems(published))

  for (const route of marketingRoutes(published)) {
    const table = TERMINOLOGY_TABLES[route.locale]
    if (table === undefined) continue
    // The same rule as the store listing, on the same grounds: an unreviewed
    // table does not reach a reader, and a landing page is a reader. Unlike
    // missing copy, the words DO exist here — they are simply unsigned — so
    // the page renders for review and the site stays unpublishable.
    if (table.reviewStatus !== 'approved') {
      blockers.push(
        `${route.locale} is ${table.reviewStatus}: ${route.path} would publish words ` +
          'no native speaker has signed off',
      )
    }
    const page = renderPage(table, route.locale, route.type, published, store)
    if (page !== undefined) files.push({ file: fileFor(page.path), contents: page.html })
  }

  files.push({ file: 'sitemap.xml', contents: sitemapXml(published) })
  files.push({ file: 'robots.txt', contents: robotsTxt() })

  if (store.appleAppId === undefined || store.appleAppId === '') {
    notes.push(
      'no App Store id is configured, so no iOS smart banner is emitted — ' +
        'a banner pointing at an app id that does not exist 404s on tap',
    )
  }
  if (store.androidPackage === undefined || store.androidPackage === '') {
    notes.push('no Android package is configured, so no Play smart banner is emitted')
  }
  notes.push(
    'Universal Links and App Links are NOT generated: apple-app-site-association needs ' +
      'a Team ID and assetlinks.json needs the release signing certificate fingerprint, ' +
      'neither of which exists yet',
  )

  return { files, blockers, notes }
}

export function reportOf(site: Site): string {
  const lines = [`${site.files.length} files`]
  for (const blocker of site.blockers) lines.push(`  BLOCKER  ${blocker}`)
  for (const note of site.notes) lines.push(`  note     ${note}`)
  lines.push(
    site.blockers.length === 0
      ? '  publishable'
      : `  NOT publishable — ${site.blockers.length} blockers`,
  )
  return lines.join('\n')
}
