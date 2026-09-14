/**
 * §F's ambient colour orbs — "one per document type, decorative only, never
 * intercepting taps".
 *
 * They are what the glass is glass FOR. A frosted card over a flat page is
 * just a translucent card; the blur and the saturation lift in `.glass` only
 * become visible when there is colour behind them to bend, and these are that
 * colour. Four of them, in the four type accents, so the tint moving under a
 * card as the page scrolls is the app's own palette rather than decoration
 * borrowed from nowhere.
 *
 * Three properties make them safe rather than merely pretty, and all three
 * are load-bearing:
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

import { DOCUMENT_TYPES } from '../domain/documents/types'
import { TYPE_PALETTE } from './tokens'

/**
 * Where each orb sits, as percentages of the viewport.
 *
 * Fixed positions rather than random ones: a background that is different on
 * every launch is a background somebody will file a bug about, and there is
 * no screenshot test that can hold it still.
 */
const PLACEMENT = [
  { top: '-12%', insetInlineStart: '-18%', size: '62vw' },
  { top: '18%', insetInlineEnd: '-24%', size: '55vw' },
  { top: '58%', insetInlineStart: '-20%', size: '58vw' },
  { top: '84%', insetInlineEnd: '-14%', size: '50vw' },
] as const

export function Orbs() {
  return (
    <div className="orbs" aria-hidden="true">
      {DOCUMENT_TYPES.map((type, index) => {
        const { size, ...place } = PLACEMENT[index] ?? PLACEMENT[0]
        return (
          <span
            key={type}
            className="orb"
            style={{
              ...place,
              width: size,
              height: size,
              maxWidth: '420px',
              maxHeight: '420px',
              backgroundColor: TYPE_PALETTE[type].accent,
            }}
          />
        )
      })}
    </div>
  )
}
