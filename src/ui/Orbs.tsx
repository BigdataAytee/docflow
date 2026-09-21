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
 * Where each orb sits, how strongly it shows, and how it drifts.
 *
 * Fixed rather than random: a background that differs on every launch is a
 * background somebody files a bug about, and no screenshot test can hold it
 * still. Keyed by internal type, because §F fixes colour to the type and a
 * positional array would silently re-pair them if the type order ever moved.
 *
 * PLACED IN THE CONTENT AREA, not at the corners of the viewport.
 *
 * These were transcribed from the prototype, which has no app header. The
 * blue one — the strongest at .34 — sat at `top: -70px` and the app's header
 * is opaque for the first ~110px, so it was painted entirely behind it. The
 * owner reported the glow had stopped showing, and sampling the screen
 * proved it: the pixels where the blue orb should be read (236,242,251)
 * against a page of (238,242,251). It was contributing nothing at all.
 *
 * Percentages now, so they sit in the part of the screen a person is
 * actually looking at whatever the viewport is, and so a taller phone does
 * not push the lower two off the bottom.
 *
 * AND THEY MOVE, which they never did. §F asks for ambient orbs and the
 * whole point of glass is colour shifting behind it; four gradients pinned
 * in place are a texture, not an atmosphere. The drift is deliberately
 * slower than anything else on screen — 34 to 52 seconds edge to edge, at
 * amplitudes under a fifth of each orb's own blur radius — so nothing ever
 * appears to move while you are looking at it, only to have moved. Each has
 * its own duration so they never fall into step, which is what would make it
 * read as an animation rather than as weather.
 */
const ORBS: Readonly<
  Record<
    DocumentType,
    { rgb: string; alpha: number; drift: { x: string; y: string; seconds: number }; css: React.CSSProperties }
  >
> = {
  invoice: {
    rgb: '74,96,238',
    alpha: 0.34,
    drift: { x: '26px', y: '34px', seconds: 41 },
    css: { width: '320px', height: '320px', insetInlineStart: '-86px', top: '12%' },
  },
  quotation: {
    rgb: '83,74,183',
    alpha: 0.26,
    drift: { x: '-30px', y: '26px', seconds: 52 },
    css: { width: '280px', height: '280px', insetInlineEnd: '-84px', top: '38%' },
  },
  // The lower two are anchored to the BOTTOM, which is the difference
  // between a wash and a green haze across the middle of a short page.
  receipt: {
    rgb: '15,110,86',
    alpha: 0.16,
    drift: { x: '22px', y: '-28px', seconds: 34 },
    css: { width: '250px', height: '250px', insetInlineStart: '-56px', bottom: '16%' },
  },
  waybill: {
    rgb: '186,117,23',
    alpha: 0.15,
    drift: { x: '-24px', y: '-20px', seconds: 46 },
    css: { width: '230px', height: '230px', insetInlineEnd: '-52px', bottom: '-40px' },
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
            style={
              {
                ...orb.css,
                // The gradient, not a flat fill — see the note above.
                backgroundImage: `radial-gradient(circle, rgba(${orb.rgb},${orb.alpha}), transparent 70%)`,
                // Read by the `orb-drift` keyframes; see `src/index.css`.
                '--orb-x': orb.drift.x,
                '--orb-y': orb.drift.y,
                '--orb-seconds': `${orb.drift.seconds}s`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
