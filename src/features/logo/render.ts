/**
 * Marks, drawn (§O — "Quality and output").
 *
 * §O: "**Symbol artwork is generated separately from lettering**; the name is
 * composed in bundled fonts so spelling, kerning, long names and Unicode are
 * controlled."
 *
 * That separation is the reason `symbolOf` and `letteringOf` are two functions
 * that never call each other. A generative model asked for "a logo saying
 * Ọkọrọ & Sons" returns approximate letters — a name misspelled in artwork is
 * worse than no logo, and unfixable without regenerating. Here the name is
 * TEXT, set in a bundled face, so it is exactly the name the owner typed.
 *
 * SVG only, and §O is precise about why that matters downstream: "PNG export
 * always; SVG only for true vector output." Everything here is true vector,
 * so both are honest — but the PNG is rasterised from this rather than this
 * being traced from a PNG.
 */

import type { Concept, Construction, Layout } from './concepts'
import type { Motif } from './vocabulary'

export const VIEWBOX = 100

/**
 * The geometry grammar: each motif as a path on a 100×100 field.
 *
 * Drawn at a single weight and without colour. Palette is applied at render
 * time and is explicitly NOT part of a concept's identity (§O's rubric), so it
 * cannot leak in here.
 */
const MOTIF_PATHS: Readonly<Record<Motif, string>> = {
  gear: 'M50 20a30 30 0 1 0 0 60 30 30 0 1 0 0-60Zm0 18a12 12 0 1 1 0 24 12 12 0 1 1 0-24Z M46 12h8v12h-8Z M46 76h8v12h-8Z M12 46h12v8H12Z M76 46h12v8H76Z',
  bolt: 'M50 14 34 30h10v26h12V30h10Z M34 70h32v10H34Z',
  beam: 'M14 42h72v16H14Z M22 58l12 22h10L32 58Z M78 58 66 80H56l12-22Z',
  spark: 'M50 10 58 40 88 48 58 56 50 86 42 56 12 48 42 40Z',
  leaf: 'M50 12C26 28 22 62 50 88 78 62 74 28 50 12Zm0 14v52',
  grain: 'M48 88V34h4v54Z M50 12c10 8 10 20 0 28-10-8-10-20 0-28Z M50 40c10 8 10 20 0 28-10-8-10-20 0-28Z',
  drop: 'M50 10C34 32 26 46 26 58a24 24 0 0 0 48 0c0-12-8-26-24-48Z',
  sun: 'M50 32a18 18 0 1 0 0 36 18 18 0 1 0 0-36Z M46 8h8v14h-8Z M46 78h8v14h-8Z M8 46h14v8H8Z M78 46h14v8H78Z',
  bag: 'M22 34h56l6 54H16Z M36 34c0-12 6-18 14-18s14 6 14 18',
  tag: 'M14 50 50 14h36v36L50 86Z M68 30a6 6 0 1 0 0 12 6 6 0 1 0 0-12Z',
  basket: 'M14 38h72l-8 48H22Z M32 38 44 14 M68 38 56 14',
  scale: 'M48 14h4v72h-4Z M20 30h60v6H20Z M30 36 18 62h24Z M70 36 58 62h24Z',
  wheel: 'M50 16a34 34 0 1 0 0 68 34 34 0 1 0 0-68Zm0 14a20 20 0 1 1 0 40 20 20 0 1 1 0-40Z',
  route: 'M20 80c0-24 60-32 60-56 M20 80h10 M70 24h10',
  arrow: 'M14 44h48V26l24 24-24 24V56H14Z',
  container: 'M14 30h72v46H14Z M30 30v46 M50 30v46 M70 30v46',
  book: 'M16 22h30c4 0 4 4 4 4v56s0-4-4-4H16Z M84 22H54c-4 0-4 4-4 4v56s0-4 4-4h30Z',
  pen: 'M20 80 28 58 66 20l12 12-38 38Z M20 80l8-4-4-4Z',
  cap: 'M50 20 10 38l40 18 40-18Z M26 48v20c0 6 48 6 48 0V48',
  lamp: 'M50 14a22 22 0 0 0-12 40v10h24V54a22 22 0 0 0-12-40Z M42 70h16v8H42Z',
  node: 'M50 14a10 10 0 1 0 0 20 10 10 0 1 0 0-20Z M20 62a10 10 0 1 0 0 20 10 10 0 1 0 0-20Z M80 62a10 10 0 1 0 0 20 10 10 0 1 0 0-20Z M50 34 26 62 M50 34l24 28',
  signal: 'M18 70h12v18H18Z M38 56h12v32H38Z M58 40h12v48H58Z M78 22h12v66H78Z',
  screen: 'M12 20h76v48H12Z M40 68h20v12H40Z M30 80h40v6H30Z',
  cube: 'M50 12 88 32v36L50 88 12 68V32Z M50 12v40 M50 52 12 32 M50 52l38-20',
  bottle: 'M42 12h16v14l8 12v50H34V38l8-12Z M34 52h32',
  petal: 'M50 50c0-20 10-36 0-38-10 2 0 18 0 38Zm0 0c20 0 36 10 38 0-2-10-18 0-38 0Zm0 0c0 20-10 36 0 38 10-2 0-18 0-38Zm0 0c-20 0-36-10-38 0 2 10 18 0 38 0Z',
  comb: 'M14 26h72v16H14Z M20 42v34 M32 42v34 M44 42v34 M56 42v34 M68 42v34 M80 42v34',
  mirror: 'M50 10a26 34 0 1 0 0 68 26 34 0 1 0 0-68Z M44 78h12v12H44Z',
  pot: 'M18 36h64v34c0 8-8 14-32 14s-32-6-32-14Z M12 40h8 M80 40h8 M50 12v20',
  flame: 'M50 10c-4 18-22 24-22 42a22 22 0 0 0 44 0c0-10-8-16-12-26-4 8-10 8-10 0Z',
  knife: 'M22 62 70 14l8 8-40 48Z M22 62l-8 24 24-8Z',
  cup: 'M22 30h48v30c0 10-8 18-24 18s-24-8-24-18Z M70 38h10a8 8 0 0 1 0 16h-10 M18 86h56',
  brick: 'M12 32h76v18H12Z M12 54h76v18H12Z M38 32v18 M64 32v18 M25 54v18 M51 54v18 M77 54v18',
  hammer: 'M24 20h36v18H24Z M38 38h8v48h-8Z',
  rule: 'M12 40h76v20H12Z M24 40v10 M36 40v14 M48 40v10 M60 40v14 M72 40v10',
  ladder: 'M28 12h8v76h-8Z M64 12h8v76h-8Z M36 28h28v8H36Z M36 48h28v8H36Z M36 68h28v8H36Z',
  monogram: '',
  orbit: 'M50 34a16 16 0 1 0 0 32 16 16 0 1 0 0-32Z M50 16c22 0 40 15 40 34S72 84 50 84 10 69 10 50s18-34 40-34Z',
  stack: 'M50 12 88 30 50 48 12 30Z M12 48l38 18 38-18 M12 66l38 18 38-18',
  weave: 'M14 30h72v14H14Z M14 56h72v14H14Z M30 14v72 M70 14v72',
}

export interface Palette {
  readonly ink: string
  readonly paper: string
}

/**
 * The mark alone, as SVG.
 *
 * No text anywhere in the output — that is the separation §O asks for, and
 * keeping it structural means a caller cannot accidentally bake a misspelled
 * name into artwork.
 */
export function symbolOf(concept: Concept, palette: Palette): string {
  const path = MOTIF_PATHS[concept.motif]
  const body = constructionOf(concept.construction, path, palette)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img">${body}</svg>`
}

function constructionOf(construction: Construction, path: string, palette: Palette): string {
  const { ink, paper } = palette
  // An empty path is the monogram motif, whose "geometry" is the lettering —
  // handled by the caller, because this function never draws text.
  const mark = path === '' ? `<circle cx="50" cy="50" r="34" fill="none" stroke="${ink}" stroke-width="6"/>` : ''

  switch (construction) {
    case 'solid':
      return `${mark}<path d="${path}" fill="${ink}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`
    case 'negative':
      // The motif cut OUT of a filled container: the mark becomes the gap.
      return `<mask id="m"><rect width="100" height="100" fill="#fff"/><path d="${path}" fill="#000"/></mask><rect width="100" height="100" rx="18" fill="${ink}" mask="url(#m)"/>${mark}`
    case 'radial':
      return `${mark}${[0, 90, 180, 270]
        .map(
          (angle) =>
            `<g transform="rotate(${angle} 50 50) scale(0.55) translate(41 41)"><path d="${path}" fill="${ink}"/></g>`,
        )
        .join('')}`
    case 'interlock':
      return `${mark}<g opacity="0.55"><g transform="translate(-10 0) scale(0.9) translate(5 5)"><path d="${path}" fill="${ink}"/></g><g transform="translate(10 0) scale(0.9) translate(5 5)"><path d="${path}" fill="${ink}"/></g></g>`
    case 'linear':
      return `${mark}<path d="${path}" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
    case 'banded':
      return `<defs><clipPath id="b"><path d="${path}"/></clipPath></defs><g clip-path="url(#b)"><rect width="100" height="100" fill="${ink}"/>${[18, 42, 66]
        .map((y) => `<rect x="0" y="${y}" width="100" height="8" fill="${paper}"/>`)
        .join('')}</g>${mark}`
  }
}

/**
 * The name, as text.
 *
 * Set rather than drawn, in a bundled face, so the spelling is exactly what
 * was typed — accents, Arabic, a very long name and all. `textLength` is
 * deliberately absent: squeezing a long name to fit would distort the
 * lettering, and §O asks for kerning and long names to be *controlled*, not
 * crushed.
 */
export function letteringOf(name: string, palette: Palette, size = 14): string {
  return `<text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-family="var(--logo-font, system-ui)" font-size="${size}" fill="${palette.ink}">${escapeText(name)}</text>`
}

/** The two composed, per layout. Still two separate pieces of artwork. */
export function lockupOf(
  concept: Concept,
  name: string,
  layout: Layout,
  palette: Palette,
): string {
  const mark = constructionOf(concept.construction, MOTIF_PATHS[concept.motif], palette)

  if (layout === 'symbol') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img">${mark}</svg>`
  }
  if (layout === 'horizontal') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 100" role="img"><g>${mark}</g><g transform="translate(160 0)">${letteringOf(name, palette, 18)}</g></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" role="img"><g>${mark}</g><g transform="translate(0 80)">${letteringOf(name, palette, 14)}</g></svg>`
}

/**
 * Text into SVG, safely.
 *
 * A company name is data. Left unescaped, a name containing `<` would break
 * the document — and a name is exactly the field somebody eventually pastes
 * something strange into.
 */
function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** §O: "light/dark usability". Both are checked, so neither is an afterthought. */
export const LIGHT: Palette = { ink: '#111827', paper: '#ffffff' }
export const DARK: Palette = { ink: '#f9fafb', paper: '#111827' }
