/**
 * Step 4 — Design (§H).
 *
 * "One continuous horizontal strip beneath the live preview — no
 * original/new headings; the six newer designs carry only a small green NEW
 * tag. Tapping re-renders the full preview instantly and centres the card.
 * Names never clip. Above the strip: the design-name pill, brand-colour dots,
 * the logo switch."
 */

import { useCompany } from '../../app/context'
import { TEMPLATES, type TemplateId, templateById } from '../../pdf/templates'

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
}: DesignStepProps) {
  const { strings } = useCompany()
  const current = templateById(selected)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white/85 p-3">{preview}</div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">
          {current.name}
        </span>

        <div className="flex gap-1.5" role="group" aria-label={strings.design.chooseDesign}>
          {brandColours.map((colour) => (
            <button
              key={colour}
              type="button"
              onClick={() => onBrandColour(colour)}
              aria-label={colour}
              aria-pressed={colour === brandColour}
              className="h-6 w-6 rounded-full ring-offset-2"
              style={{
                backgroundColor: colour,
                outline: colour === brandColour ? '2px solid currentColor' : undefined,
              }}
            />
          ))}
        </div>

        {/* §G: visible state, aria-pressed, and a hint line that MATCHES it. */}
        <button
          type="button"
          onClick={() => onToggleLogo(!showLogo)}
          aria-pressed={showLogo}
          className="ml-auto flex min-h-tap items-center gap-2 rounded-full bg-page px-3 text-xs font-semibold"
        >
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 ${
              showLogo ? 'justify-end bg-status-good' : 'justify-start bg-navy/25'
            }`}
          >
            <span className="h-4 w-4 rounded-full bg-white" />
          </span>
          {showLogo ? strings.design.logoOn : strings.design.logoOff}
        </button>
      </div>

      <p className="text-xs opacity-70">
        {showLogo ? strings.design.logoOnHint : strings.design.logoOffHint}
      </p>

      {/* One continuous strip — no original/new headings (§H). */}
      <div className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-3 pb-2">
          {TEMPLATES.map((template) => (
            <li key={template.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(template.id)}
                aria-pressed={template.id === selected}
                className={`w-28 rounded-xl border-2 bg-white p-2 text-left ${
                  template.id === selected ? 'border-brand' : 'border-transparent'
                }`}
              >
                <span
                  className="block h-20 rounded-lg"
                  style={{ backgroundColor: template.paper, boxShadow: 'inset 0 0 0 1px #1d245222' }}
                  aria-hidden="true"
                />
                <span className="mt-1.5 flex items-center gap-1">
                  {/* Names never clip (§H): the label wraps instead. */}
                  <span className="break-words text-[11px] font-semibold leading-tight">
                    {template.name}
                  </span>
                  {template.isNew && (
                    <span className="shrink-0 rounded bg-status-good-tint px-1 text-[9px] font-bold text-status-good">
                      {strings.design.newTag}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
