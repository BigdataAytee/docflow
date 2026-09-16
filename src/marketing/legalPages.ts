/**
 * The legal documents as published pages (§T, §P).
 *
 * Both stores require a privacy policy at a URL a reviewer can open without
 * installing anything, so the same text the app renders is emitted here as
 * plain HTML. One source (`src/legal/documents.ts`), two renderers — the
 * pattern the terminology layer already uses for the UI and the PDF.
 *
 * ENGLISH ONLY, and outside the locale cluster. The marketing pages come in a
 * set per locale with `hreflang` joining them; these deliberately do not,
 * because §S's "absent beats a bad translation" is at its sharpest in a
 * limitation-of-liability clause. A French `hreflang` pointing at English
 * legal text would be a worse answer than one URL that is honestly English.
 *
 * INDEXABLE, unlike the signing pages. §T's rule is that customer documents
 * must never enter a search index; a privacy policy is the opposite — a
 * reviewer and a customer should both be able to find it.
 */

import { LEGAL_DOCUMENTS, type LegalDocument } from '../legal/documents'
import { absolute } from './seo'

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** The same small vocabulary the in-app renderer handles. */
function bodyHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`
      if (block.startsWith('- ')) {
        const items = block
          .split('\n')
          .map((line) => `<li>${inline(line.replace(/^- /, ''))}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }
      return `<p>${inline(block.replace(/\n/g, ' '))}</p>`
    })
    .join('\n    ')
}

const inline = (text: string): string =>
  escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

const STYLE = `
  :root { color-scheme: light dark; --ink: #0b1320; --paper: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --ink: #eef2ff; --paper: #0b1120; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 44rem; margin: 0 auto; padding: 3rem 1.25rem 6rem; }
  h1 { font-size: clamp(1.5rem, 4vw, 2.25rem); line-height: 1.15; margin: 0 0 1.5rem; }
  h2 { font-size: 1.125rem; margin: 2rem 0 .5rem; }
  ul { padding-inline-start: 1.25rem; }
  li { margin: .35rem 0; }
  code { background: rgb(128 128 128 / .18); padding: .1em .35em; border-radius: .25rem; }
  nav { margin-bottom: 2rem; font-size: .9rem; }
  nav a { margin-inline-end: 1rem; }
  a { color: inherit; }
`.trim()

/** The other two, so a reader can move between them without going back. */
function crossLinks(current: LegalDocument): string {
  const links = LEGAL_DOCUMENTS.filter((document) => document.id !== current.id).map(
    (document) => `<a href="${escapeHtml(absolute(`/${document.slug}`))}">${escapeHtml(document.title)}</a>`,
  )
  return `<nav aria-label="Legal documents">${links.join('')}</nav>`
}

export function legalPageHtml(document: LegalDocument): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)} — DocFlow</title>
    <meta name="description" content="${escapeHtml(document.title)} for DocFlow." />
    <meta name="robots" content="index, follow" />
    <meta name="referrer" content="no-referrer" />
    <link rel="canonical" href="${escapeHtml(absolute(`/${document.slug}`))}" />
    <style>${STYLE}</style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(document.title)}</h1>
      ${crossLinks(document)}
      ${bodyHtml(document.body)}
    </main>
  </body>
</html>
`
}

export interface LegalPage {
  readonly file: string
  readonly path: string
  readonly contents: string
}

export function legalPages(): LegalPage[] {
  return LEGAL_DOCUMENTS.map((document) => ({
    file: `${document.slug}/index.html`,
    path: `/${document.slug}`,
    contents: legalPageHtml(document),
  }))
}
