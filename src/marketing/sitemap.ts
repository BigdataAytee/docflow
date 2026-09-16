/**
 * The sitemap and robots.txt (§T).
 *
 * §T's privacy boundary, which is the reason this file is small and careful:
 * "public signing/acceptance pages (§P) are `noindex, nofollow` and **excluded
 * from the sitemap** — customer documents must never enter a search index.
 * Only marketing pages are crawlable."
 *
 * So the sitemap is built by ENUMERATING the marketing route table, never by
 * walking a directory or filtering a list of everything. A sitemap built by
 * exclusion is one forgotten rule away from publishing a customer's invoice;
 * a sitemap built by inclusion cannot contain a page nobody added to the
 * route table, which is the only version of this guarantee that survives
 * somebody adding a route in a hurry.
 */

import type { LocaleId } from '../domain/locale/types'
import { absolute } from './seo'
import { legalPages } from './legalPages'
import { alternatesFor, marketingRoutes, redirects } from './routes'

/** The app's own routes. Not marketing, not crawlable, never in the sitemap. */
export const APP_PATH_PREFIXES = ['/app', '/d/', '/sign/', '/accept/'] as const

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

/**
 * A sitemap carrying the `hreflang` cluster on every entry.
 *
 * The cluster has to appear in BOTH places — in each page's head and against
 * each sitemap entry — because a search engine that finds the pages by
 * crawling and a search engine that finds them by sitemap must be told the
 * same thing, and disagreeing is worse than saying nothing.
 */
export function sitemapXml(locales: readonly LocaleId[]): string {
  const entries = marketingRoutes(locales).map((route) => {
    const alternates = alternatesFor(route.type, locales)
      .map(
        (alternate) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" ` +
          `href="${escapeXml(absolute(alternate.path))}" />`,
      )
      .join('\n')
    return `  <url>\n    <loc>${escapeXml(absolute(route.path))}</loc>\n${alternates}\n  </url>`
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    // The legal pages. No hreflang cluster on these: they are English only,
    // and a cluster naming a language that does not exist advertises a 404.
    ...legalPages().map(
      (page) => `  <url>\n    <loc>${escapeXml(absolute(page.path))}</loc>\n  </url>`,
    ),
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * robots.txt.
 *
 * The disallows are belt AND braces: the signing and acceptance pages already
 * send `noindex, nofollow` themselves, and the edge function sends
 * `x-robots-tag` with it. Neither of those helps if a crawler never fetches
 * the page but finds the URL in a link — and a token in a URL is the thing
 * that must not be indexed. `Disallow` and `noindex` fail in opposite
 * directions, so §P gets both.
 */
export function robotsTxt(): string {
  return [
    'User-agent: *',
    ...APP_PATH_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    'Allow: /',
    '',
    `Sitemap: ${absolute('/sitemap.xml')}`,
    '',
  ].join('\n')
}

/** Old address → new, for the host's redirect configuration. */
export function redirectMap(locales: readonly LocaleId[]): Readonly<Record<string, string>> {
  return redirects(locales)
}
