/**
 * One card in the builder (§G).
 *
 * "Four compact cards with tinted header strips." The strip is NEUTRAL and
 * only the icon and the small-caps title carry the type accent: four
 * accent-tinted bands down a form make the colour the loudest thing on a
 * screen whose job is the fields, and §G puts those fields on one screen on
 * purpose.
 *
 * Shared by every step rather than copied per step — the strip, its hairline
 * and its type-coloured title are the shape a reader learns once.
 */

import type { ReactNode } from 'react'

import { Icon, type IconName } from '../../ui'

export interface BuilderCardProps {
  readonly title: string
  readonly icon: IconName
  readonly accent: string
  /** The small control some strips carry — adding a contact, a method, a list. */
  readonly action?: ReactNode
  readonly children: ReactNode
}

export function BuilderCard({ title, icon, accent, action, children }: BuilderCardProps) {
  return (
    <section className="glass-solid overflow-hidden rounded-2xl">
      {/*
        h2, not h3. The only heading above these cards is the builder's h1, so
        an h3 leaves a reader jumping by heading level with nothing at level 2
        and no way to tell where the step begins. Found by the screen-reader
        sweep, which reads Chromium's accessibility tree rather than the DOM.
      */}
      <div className="card-strip flex items-center gap-2 px-3 py-2">
        <span style={{ color: accent }}>
          <Icon name={icon} size={0.9} />
        </span>
        <h2
          className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.5px]"
          style={{ color: accent }}
        >
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-3 px-3 py-2.5">{children}</div>
    </section>
  )
}

/**
 * The small square control that sits in a strip, or beside a field.
 *
 * Tinted with the type rather than filled with it: it is a secondary action
 * next to a heading, and a saturated square there competes with the primary
 * button at the foot of the screen.
 */
export function TinyButton({
  label,
  icon,
  accent,
  tint,
  onClick,
  size = 23,
}: {
  label: string
  icon: IconName
  accent: string
  tint: string
  onClick: () => void
  size?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="tap-scale grid shrink-0 place-items-center rounded-lg"
      style={{
        width: size,
        height: size,
        backgroundImage: `linear-gradient(180deg, ${tint}, #fff)`,
        color: accent,
        boxShadow: `0 2px 5px ${accent}29, inset 0 1px 0 #fff`,
      }}
    >
      <Icon name={icon} size={size >= 30 ? 1 : 0.8} />
    </button>
  )
}
