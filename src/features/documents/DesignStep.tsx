/**
 * Step 4 — Design (§H).
 *
 * "One continuous horizontal strip beneath the live preview — no
 * original/new headings; the six newer designs carry only a small green NEW
 * tag. Tapping re-renders the full preview instantly and centres the card.
 * Names never clip. Above the strip: the design-name pill, brand-colour dots,
 * the logo switch."
 *
 * Two of those clauses are the reason this file has any logic at all:
 *
 * · **"Centres the card."** Tapping scrolls the chosen design to the middle
 *   of the strip, so the ones on either side of it are the ones you compare
 *   it against. Without it, picking the sixteenth design leaves it pinned to
 *   the right edge with nothing after it.
 * · **"Names never clip."** The prototype's cards ellipsis their labels, and
 *   §H is explicit that they must not — so the name WRAPS here and the card
 *   grows, which is the same rule §F applies to every other surface carrying
 *   a name.
 */

import { useEffect, useRef } from 'react'

import { useCompany } from '../../app/context'
import { TYPE_PALETTE } from '../../ui'
import type { DocumentType } from '../../domain/documents/types'
import { TEMPLATES, type TemplateId, templateById } from '../../pdf/templates'
import { TemplateThumb } from './TemplateThumb'

export interface DesignStepProps {
  readonly selected: TemplateId
  readonly showLogo: boolean
  readonly brandColours: readonly string[]
  readonly brandColour: string
  readonly onSelect: (id: TemplateId) => void
  readonly onToggleLogo: (next: boolean) => void
  readonly onBrandColour: (colour: string) => void
  /** The live preview, rendered by the caller from the same shared state (§H). */
  readonly preview: React.ReactNode
  /** Colours the pill and the selected card with the document's own accent. */
  readonly type?: DocumentType
}

export function DesignStep({
  selected,
  showLogo,
  brandColours,
  brandColour,
  onSelect,
  onToggleLogo,
  onBrandColour,
  preview,
  type = 'invoice',
}: DesignStepProps) {
  const { strings } = useCompany()
  const current = templateById(selected)
  const { accent, tint } = TYPE_PALETTE[type]
  const strip = useRef<HTMLUListElement>(null)

  /*
   * §H: "tapping re-renders the full preview instantly and centres that card".
   * Runs on `selected` rather than in the click handler so the strip also
   * centres the design a draft was opened with — arriving at this step with
   * "Aria" chosen should not start you scrolled to "Classic".
   */
  useEffect(() => {
    const card = strip.current?.querySelector(`[data-template="${selected}"]`)
    // Guarded because `scrollIntoView` is not universal: jsdom does not
    // implement it at all, and centring a card is a nicety rather than the
    // feature — a design that cannot scroll itself into view is still
    // chosen. Without the guard this throws during render and takes seven
    // unrelated builder journeys down with it.
    if (typeof card?.scrollIntoView === 'function') {
      card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }
  }, [selected])

  return (
    <div className="space-y-2.5">
      <div className="glass-solid overflow-hidden rounded-2xl p-2.5">{preview}</div>

      <div className="flex items-center gap-2">
        {/* The design's own name — never localised, it is a proper noun (§H). */}
        <span
          className="shrink-0 rounded-[11px] px-2.5 py-1.5 text-[10.5px] font-semibold"
          style={{
            backgroundImage: `linear-gradient(180deg, rgb(var(--surface)), ${tint})`,
            color: accent,
            boxShadow: `0 3px 8px ${accent}24`,
          }}
        >
          {current.name}
        </span>

        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto p-0.5"
          role="group"
          aria-label={strings.design.brandColour}
        >
          {brandColours.map((colour) => (
            <button
              key={colour}
              type="button"
              onClick={() => onBrandColour(colour)}
              aria-label={colour}
              aria-pressed={colour === brandColour}
              className="h-[22px] w-[22px] shrink-0 rounded-full border-2"
              style={{
                backgroundColor: colour,
                // The ring is INK, not the colour itself — a swatch cannot
                // show its own selection by being more of the same colour.
                borderColor: colour === brandColour ? '#1d2452' : 'transparent',
                boxShadow: `0 2px 6px ${colour}59, inset 0 1px 0 rgb(255 255 255 / 0.4)`,
              }}
            />
          ))}
        </div>

        {/* §G: visible state, aria-pressed, and a hint line that MATCHES it. */}
        <button
          type="button"
          onClick={() => onToggleLogo(!showLogo)}
          aria-pressed={showLogo}
          className={`tap-scale flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1.5 text-[10px] font-semibold ${
            showLogo
              ? 'border-status-good/40 bg-status-good-tint text-status-good'
              : 'border-edge/10 bg-surface text-ink/45'
          }`}
        >
          <span
            className={`relative h-[13px] w-[22px] shrink-0 rounded-full ${
              showLogo ? 'bg-status-good' : 'bg-ink/25'
            }`}
          >
            <span
              className="absolute top-[2px] h-[9px] w-[9px] rounded-full bg-on-accent shadow-sm motion-safe:transition-all"
              style={{ left: showLogo ? '11px' : '2px' }}
            />
          </span>
          {showLogo ? strings.design.logoOn : strings.design.logoOff}
        </button>
      </div>

      {/* One continuous strip — no original/new headings (§H). */}
      <div className="-mx-3 px-3">
        <ul
          ref={strip}
          className="flex snap-x snap-proximity gap-[7px] overflow-x-auto px-0.5 pb-2 pt-1"
        >
          {TEMPLATES.map((template) => {
            const chosen = template.id === selected
            return (
              <li key={template.id} className="shrink-0 snap-center">
                <button
                  type="button"
                  data-template={template.id}
                  onClick={() => onSelect(template.id)}
                  aria-pressed={chosen}
                  className="relative block w-[72px] rounded-xl border-2 p-1 text-center"
                  style={{
                    borderColor: chosen ? accent : 'var(--field-border)',
                    backgroundImage: chosen
                      ? `linear-gradient(180deg, rgb(var(--surface)), ${tint})`
                      : 'var(--field-image)',
                    boxShadow: chosen
                      ? `0 8px 18px -4px ${accent}5c`
                      : '0 5px 12px -3px rgb(43 63 214 / 0.2)',
                  }}
                >
                  <TemplateThumb template={template} accent={brandColour} />

                  {/*
                    Wraps rather than ellipsing. The prototype truncates these
                    and §H says names never clip — so the card grows by a line
                    instead, which is what every other named surface does (§F).
                  */}
                  <span
                    className="mt-1 block text-[8.5px] font-semibold leading-tight [overflow-wrap:anywhere]"
                    // The accent is locked in both themes (§F); its opposite
                    // is a token, because a grey picked to read quietly on a
                    // white card is illegible on a dark one.
                    style={{ color: chosen ? accent : 'var(--step-pending-ink)' }}
                  >
                    {template.name}
                  </span>

                  {/* §H: the six newer designs carry only a small green tag. */}
                  {template.isNew && (
                    <span
                      aria-hidden="true"
                      className="absolute end-0.5 top-0.5 rounded-[3px] px-1 text-[5.5px] font-bold leading-[1.4] text-white"
                      style={{ backgroundImage: 'linear-gradient(180deg,#189a76,#0F6E56)' }}
                    >
                      {strings.design.newTag}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[10px] leading-relaxed opacity-45">
        {showLogo ? strings.design.logoOnHint : strings.design.logoOffHint}
      </p>
    </div>
  )
}
