/**
 * §F's ambient colour orbs — "one per document type, decorative only, never
 * intercepting taps".
 *
 * They are what the glass is glass FOR. A frosted pane over a flat page is
 * just a translucent pane; the blur and the saturation lift in `.glass` only
 * become visible when there is colour behind them to bend, and these are that
 * colour. Four of them, in the four type accents, so the tint moving under a
 * card as the page scrolls is the app's own palette rather than decoration
 * borrowed from nowhere.
 *
 * Placements, sizes and alphas are transcribed from
 * `docs/design-reference/prototype.html`. Two details in it are the
 * difference between this and a blurry mess:
 *
 * · **Each orb is a radial gradient, not a flat disc.** A blurred flat circle
 *   still has an edge where the blur runs out; a radial gradient to
 *   transparent at 70% has none, which is why these read as light in the page
 *   rather than as four coloured blobs on it.
 * · **The alphas are per type, and deliberately unequal** — blue .34, violet
 *   .26, green .16, amber .15. The two warm ones are held back because warmth
 *   advances: at the blue's alpha the amber orb tints the glass above it and
 *   the card stops looking white.
 *
 * Three properties make them safe rather than merely pretty:
 *  · `pointer-events: none` (in `.orbs`) — §F's "never intercepting taps";
 *  · `aria-hidden` — they are not content, and a screen reader reading four
 *    unnamed divs at the top of every page is noise on every page;
 *  · `position: fixed` behind `z-index: 0` — they never grow the document,
 *    so they cannot be the thing that makes a page scroll sideways.
 *
 * They disappear entirely on the low tier and under reduced transparency; see
 * `.no-glass .orbs` in `src/index.css`. That is §F's performance fallback,
 * and it is the right first thing to drop: four large blurred gradients are
 * the most expensive paint on the screen and the only one nobody is reading.
 */

import { DOCUMENT_TYPES, type DocumentType } from '../domain/documents/types'

/**
 * Where each orb sits and how strongly it shows, per the prototype.
 *
 * Fixed rather than random: a background that differs on every launch is a
 * background somebody files a bug about, and no screenshot test can hold it
 * still. Keyed by internal type, because §F fixes colour to the type and a
 * positional array would silently re-pair them if the type order ever moved.
 */
const ORBS: Readonly<Record<DocumentType, { rgb: string; alpha: number; css: React.CSSProperties }>> =
  {
    invoice: {
      rgb: '74,96,238',
      alpha: 0.34,
      css: { width: '300px', height: '300px', insetInlineStart: '-90px', top: '-70px' },
    },
    quotation: {
      rgb: '83,74,183',
      alpha: 0.26,
      css: { width: '260px', height: '260px', insetInlineEnd: '-80px', top: '200px' },
    },
    // The lower two are anchored to the BOTTOM, which is the difference
    // between a wash and a green haze across the middle of a short page.
    receipt: {
      rgb: '15,110,86',
      alpha: 0.16,
      css: { width: '240px', height: '240px', insetInlineStart: '-60px', bottom: '120px' },
    },
    waybill: {
      rgb: '186,117,23',
      alpha: 0.15,
      css: { width: '220px', height: '220px', insetInlineEnd: '-50px', bottom: '-60px' },
    },
  }

export function Orbs() {
  return (
    <div className="orbs" aria-hidden="true">
      {DOCUMENT_TYPES.map((type) => {
        const orb = ORBS[type]
        return (
          <span
            key={type}
            className="orb"
            style={{
              ...orb.css,
              // The gradient, not a flat fill — see the note above.
              backgroundImage: `radial-gradient(circle, rgba(${orb.rgb},${orb.alpha}), transparent 70%)`,
            }}
          />
        )
      })}
    </div>
  )
}
