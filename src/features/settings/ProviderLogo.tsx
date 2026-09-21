/**
 * The round badge a provider's mark sits in (§F, §J).
 *
 * FIXED 40px, ALWAYS PRESENT. Every row's badge is the same circle whether
 * there is a mark in it or not, so a list of eleven providers lines up down
 * the left edge and a provider with no bundled logo does not leave a row
 * looking half-built. For most of these, missing is the documented state —
 * no free source for the mark — and it has to read as deliberate.
 *
 * A LIGHT TILE, IN BOTH THEMES. The marks are single-colour brand glyphs in
 * their owner's own hex: Monzo's navy and Revolut's near-black vanish on a
 * dark surface. So the circle stays light in dark mode and the mark keeps its
 * colour, which is what the guidelines contemplate. Inverting or recolouring
 * a trademark to suit our background is modifying it, and every set of
 * guidelines says not to.
 *
 * THE NAME IS STILL THE LABEL. The mark is decoration beside it, never
 * instead of it — `alt=""` and `aria-hidden`, because a screen reader
 * announcing "PayPal PayPal" is worse than one announcing the name once.
 * That is also what makes the fallback free: nothing about the row's meaning
 * lives in the image.
 */

import { logoFor } from '../payments/logos'
import type { ProviderId } from '../../domain/payments/providers'
import { useThemeChoice } from '../theme/ThemeContext'
import { Icon } from '../../ui'

export interface ProviderLogoProps {
  readonly provider: ProviderId
  /** For the lettered fallback — the first letter of what a person reads. */
  readonly name: string
}

export function ProviderLogo({ provider, name }: ProviderLogoProps) {
  const { scheme } = useThemeChoice()
  const mark = logoFor(provider, scheme)
  const isEscapeHatch = provider === 'other_link'

  return (
    <span
      data-provider-logo={provider}
      data-has-mark={mark === null ? 'false' : 'true'}
      /*
       * `bg-logo-tile`, which is light in BOTH themes — see its declaration.
       * A theme-following surface would take the light background away in
       * exactly the mode a navy glyph needs it. The ring is what keeps a
       * white circle from disappearing on a white card.
       */
      className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-logo-tile ring-1 ring-ink/10"
    >
      {mark !== null ? (
        <img
          src={mark}
          // Decoration. The name beside it is the label (§F, a11y).
          alt=""
          aria-hidden="true"
          /*
           * `contain` inside the circle: a mark keeps its own proportions and
           * its own clear space rather than being cropped to fill a shape it
           * was not drawn for.
           */
          className="size-[22px] object-contain"
          draggable={false}
        />
      ) : isEscapeHatch ? (
        /*
         * NOT A LETTER for the escape hatch. "Payment link" is not a company,
         * and a P in a circle would read as a brand this row does not have.
         */
        <Icon name="credit-card" className="size-[18px] text-ink/45" aria-hidden />
      ) : (
        /*
         * THE PROVIDER'S FIRST LETTER, in a neutral grey.
         *
         * Neutral is the whole point: a letter in a BRAND colour is a mark
         * somebody designed, and implying one for a trademark we do not carry
         * is worse than carrying none. This is a placeholder that looks like
         * a placeholder, at exactly the size of the ones that are not.
         */
        <span aria-hidden className="text-sm font-semibold text-ink/45">
          {[...name.trim()][0]?.toUpperCase() ?? '?'}
        </span>
      )}
    </span>
  )
}
