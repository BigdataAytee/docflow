/**
 * The square slot a provider's mark sits in (§F, §J).
 *
 * FIXED SIZE, ALWAYS PRESENT. The slot is the same 36px square whether there
 * is a mark in it or not, so a provider without one does not leave a row
 * shorter than its neighbours or a name hanging where an icon should be. A
 * missing logo has to look deliberate, because for most of these it is: a
 * mark nobody has fetched yet, or one whose guidelines do not permit this.
 *
 * THE NAME IS STILL THE LABEL. The mark is decoration beside it, never
 * instead of it — `alt=""` and `aria-hidden`, because a screen reader
 * announcing "PayPal PayPal" is worse than one announcing the name once.
 * That is also what makes the fallback free: nothing about the row's meaning
 * lives in the image.
 *
 * NEVER RECOLOURED, NEVER INVERTED. `logoFor` picks the provider's own dark
 * variant when they supply one and their light one otherwise. No filter, no
 * mix-blend, no `dark:invert` — every one of those is a modified mark, and
 * every set of brand guidelines says not to modify the mark.
 */

import { logoFor } from '../../domain/payments/logos'
import type { ProviderId } from '../../domain/payments/providers'
import { useThemeChoice } from '../theme/ThemeContext'
import { Icon } from '../../ui'

export interface ProviderLogoProps {
  readonly provider: ProviderId
}

export function ProviderLogo({ provider }: ProviderLogoProps) {
  const { scheme } = useThemeChoice()
  const mark = logoFor(provider, scheme)

  return (
    <span
      data-provider-logo={provider}
      data-has-mark={mark === null ? 'false' : 'true'}
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/10 text-brand"
    >
      {mark === null ? (
        /*
         * THE SAME GENERIC CARD every unlogo'd row has always had. Not an
         * empty box and not the provider's initial: a letter in a coloured
         * circle reads as a mark somebody designed, which is the one thing
         * this must not imply about a trademark it does not carry.
         */
        <Icon name="credit-card" className="size-[18px]" />
      ) : (
        <img
          src={mark}
          // Decoration. The name beside it is the label (§F, a11y).
          alt=""
          aria-hidden="true"
          /*
           * `contain` inside a fixed box: a mark keeps its own proportions
           * and its own clear space, and a wordmark wider than it is tall
           * sits inside the square rather than being cropped to fill it.
           */
          className="size-[22px] object-contain"
          draggable={false}
        />
      )}
    </span>
  )
}
