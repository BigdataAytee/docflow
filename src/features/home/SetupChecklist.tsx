/**
 * "Your next steps" on Home (§18, §R).
 *
 * "Short, dismissible items such as add business details, add a logo, set up
 * payment and create a first document. Completing the underlying action
 * updates the checklist automatically."
 *
 * **Automatically is the load-bearing word**, and it is why this component
 * holds no state of its own. Every row is DERIVED by
 * `src/features/onboarding/checklist.ts` from the thing it describes, so
 * there is no "done" flag to set and no way for the list to disagree with the
 * app. Adding a logo in Settings ticks the logo row because the row is a
 * question about the logo, not a record of a tap.
 *
 * The logic has existed since Phase 2 and nothing ever rendered it — the card
 * is what was missing, not the rules.
 */

import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'
import { Icon, type IconName } from '../../ui'
import type { ChecklistItem, ChecklistItemId } from '../onboarding/checklist'

export interface SetupChecklistProps {
  readonly items: readonly ChecklistItem[]
  readonly onStart: (id: ChecklistItemId) => void
  readonly onGuide: () => void
  readonly onHide: () => void
}

/** Fixed to the step, like every other icon pairing in the app (§F). */
const ICONS: Readonly<Record<ChecklistItemId, IconName>> = {
  business_details: 'settings',
  logo: 'photo',
  payment: 'credit-card',
  first_document: 'file-invoice',
}

export function SetupChecklist({ items, onStart, onGuide, onHide }: SetupChecklistProps) {
  const { strings } = useCompany()

  const labels: Readonly<Record<ChecklistItemId, string>> = {
    business_details: strings.setup.businessDetails,
    logo: strings.setup.logo,
    payment: strings.setup.payment,
    first_document: strings.setup.firstDocument,
  }

  const done = items.filter((item) => item.done).length

  return (
    <section className="glass my-4 rounded-[18px] p-3.5" aria-label={strings.setup.title}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[13px] font-semibold">{strings.setup.title}</h2>
        {/*
          `aria-live`: ticking a row happens because something was done on
          ANOTHER screen, so the count changes without this card being
          touched. Announcing it is how that lands for a reader.
        */}
        <span className="text-[10px] opacity-55" aria-live="polite">
          {format(strings.setup.progress, { done, total: items.length })}
        </span>
      </div>

      <p className="mb-2.5 mt-1.5 text-[10.5px] leading-relaxed opacity-55">{strings.setup.body}</p>

      <ul>
        {items.map((item) => (
          <li key={item.id} className="border-b border-edge/[0.08] last:border-0">
            <button
              type="button"
              onClick={() => onStart(item.id)}
              className="flex min-h-tap w-full items-center gap-2 py-2.5 text-start text-[11px]"
            >
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                  item.done ? 'bg-status-good-tint text-status-good' : 'bg-brand-tint text-brand'
                }`}
              >
                <Icon name={item.done ? 'file-check' : ICONS[item.id]} size={0.8} />
              </span>

              {/*
                A done row keeps its place and is struck through rather than
                vanishing. A list that reorders itself as you work through it
                loses the one thing it was for — knowing how far along you are.
              */}
              <span
                className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${
                  item.done ? 'line-through opacity-45' : ''
                }`}
              >
                {labels[item.id]}
              </span>

              {!item.done && (
                <span className="ms-auto shrink-0 text-[10px] font-medium text-brand">
                  {strings.setup.start} →
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex justify-between">
        <button
          type="button"
          onClick={onGuide}
          className="min-h-tap text-[11px] text-brand underline underline-offset-[3px]"
        >
          {strings.setup.viewGuide}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="min-h-tap text-[11px] text-brand underline underline-offset-[3px]"
        >
          {strings.setup.hide}
        </button>
      </div>
    </section>
  )
}
