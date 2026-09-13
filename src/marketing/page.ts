/**
 * A landing page, as a static HTML document (§T: "fast, static").
 *
 * §T also asks that each page "demonstrates the real product (template gallery
 * renders from the same sixteen designs) rather than stock copy" — so the
 * gallery below is drawn from `src/pdf/templates`, in each design's own paper,
 * ink and header style. It is the real registry the app renders from, not a
 * picture of one, which means a design that changes changes here too and a
 * design that is deleted cannot be advertised.
 *
 * Every word a reader sees comes from the §D terminology table (Rule 4). The
 * address comes from the pinned route table, and never from either.
 */

import { TEMPLATES } from '../pdf/templates'
import type { DocumentType } from '../domain/documents/types'
import type { LocaleId, TerminologyTable } from '../domain/locale/types'
import { type PageHead, headFor } from './seo'

/**
 * The store smart-banner is emitted ONLY when there is an app to point at.
 *
 * §T asks for smart banners; an App Store id is a fact about a submitted app
 * and nothing has been submitted. `app-id=0000000000` would render a banner
 * that 404s on tap, which is worse than no banner — so the config is optional
 * and its absence is silent to the reader and loud in the report.
 */
export interface StoreIds {
  readonly appleAppId?: string
  readonly androidPackage?: string
}

export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

function galleryHtml(): string {
  const cards = TEMPLATES.map((template) => {
    const tag = template.isNew ? '<span class="new">NEW</span>' : ''
    return (
      `<li class="swatch" style="background:${escapeHtml(template.paper)};` +
      `color:${escapeHtml(template.ink)}">` +
      `<span class="rule rule--${escapeHtml(template.headerStyle)}"></span>` +
      `<span class="name">${escapeHtml(template.name)}</span>${tag}</li>`
    )
  })
  return `<ul class="gallery">${cards.join('')}</ul>`
}

function bannerMeta(store: StoreIds): string {
  const tags: string[] = []
  if (store.appleAppId !== undefined && store.appleAppId !== '') {
    tags.push(`<meta name="apple-itunes-app" content="app-id=${escapeHtml(store.appleAppId)}" />`)
  }
  return tags.join('\n    ')
}

const STYLE = `
  :root { color-scheme: light dark; --ink: #0b1320; --paper: #ffffff; --brand: #1e3a8a; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eef2ff; --paper: #0b1120; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
         font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 60rem; margin: 0 auto; padding: 3rem 1rem; }
  h1 { font-size: clamp(1.75rem, 5vw, 3rem); line-height: 1.1; margin: 0 0 1rem; }
  p.lede { font-size: 1.125rem; max-width: 40ch; }
  .gallery { list-style: none; display: grid; gap: .75rem; padding: 0; margin: 2rem 0 0;
             grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); }
  .swatch { position: relative; border-radius: .5rem; padding: 1rem .75rem 2.5rem;
            box-shadow: 0 1px 3px rgb(0 0 0 / .2); min-height: 7rem; }
  .swatch .rule { display: block; height: .35rem; border-radius: .2rem;
                  background: currentColor; opacity: .55; margin-bottom: .6rem; }
  .swatch .name { font-weight: 600; }
  .new { position: absolute; inset-inline-end: .6rem; bottom: .6rem; font-size: .7rem;
         font-weight: 700; color: #047857; }
`.trim()

export function pageHtml(
  head: PageHead,
  table: TerminologyTable,
  type: DocumentType,
  store: StoreIds = {},
): string {
  const term = table.types[type]
  const alternates = head.alternates
    .map(
      (alternate) =>
        `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" ` +
        `href="${escapeHtml(alternate.href)}" />`,
    )
    .join('\n    ')
  const banner = bannerMeta(store)

  return `<!doctype html>
<html lang="${escapeHtml(head.lang)}" dir="${head.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(head.title)}</title>
    <meta name="description" content="${escapeHtml(head.description)}" />
    <meta name="robots" content="${escapeHtml(head.robots)}" />
    <link rel="canonical" href="${escapeHtml(head.canonical)}" />
    ${alternates}${banner === '' ? '' : `\n    ${banner}`}
    <style>${STYLE}</style>
    <script type="application/ld+json">${head.jsonLd}</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(term.label)}</h1>
      <p class="lede">${escapeHtml(head.description)}</p>
      ${galleryHtml()}
    </main>
  </body>
</html>
`
}

export interface RenderedPage {
  readonly path: string
  readonly html: string
}

export function renderPage(
  table: TerminologyTable,
  locale: LocaleId,
  type: DocumentType,
  locales: readonly LocaleId[],
  store: StoreIds = {},
): RenderedPage | undefined {
  const head = headFor(table, locale, type, locales)
  return head === undefined
    ? undefined
    : { path: head.path, html: pageHtml(head, table, type, store) }
}
