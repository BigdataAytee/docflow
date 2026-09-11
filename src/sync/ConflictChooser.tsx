/**
 * The conflict chooser (§L7).
 *
 * "Sola changed this too… See both / Use mine / Use theirs; both versions are
 * saved" — in plain language, in the active language.
 *
 * Nothing here says merge, revision, version or conflict. §L7 gives the exact
 * register: a sentence about a person, and a choice. The machinery that made
 * this necessary is not the user's problem.
 */

import { useState } from 'react'

import { useCompany } from '../app/context'
import { format } from '../domain/locale/data/strings'
import type { ConflictChoice, Resolution } from './conflicts'

export interface ConflictChooserProps {
  readonly resolution: Extract<Resolution, { kind: 'conflict' }>
  /** Who made the other edit, for the sentence §L7 writes. */
  readonly otherPersonName: string
  readonly onChoose: (choice: ConflictChoice) => void
  /** Formats a field's value for display. */
  readonly formatValue?: (field: string, value: unknown) => string
}

export function ConflictChooser({
  resolution,
  otherPersonName,
  onChoose,
  formatValue = (_field, value) => String(value ?? ''),
}: ConflictChooserProps) {
  const { strings } = useCompany()
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      role="alertdialog"
      aria-label={format(strings.conflict.title, { person: otherPersonName })}
      className="space-y-3 rounded-2xl bg-status-info-tint p-4 text-status-info"
    >
      <div>
        <h2 className="text-sm font-bold">
          {format(strings.conflict.title, { person: otherPersonName })}
        </h2>
        <p className="mt-0.5 text-xs">{strings.conflict.body}</p>
      </div>

      {expanded && (
        <dl className="space-y-2 rounded-xl bg-white/70 p-3 text-xs">
          {resolution.fields.map((field) => (
            <div key={field} className="space-y-1">
              <dt className="font-semibold opacity-70">{field}</dt>
              <dd className="flex flex-col gap-1">
                <span>
                  <b>{strings.conflict.mine}:</b> {formatValue(field, resolution.mine[field])}
                </span>
                <span>
                  <b>{strings.conflict.theirs}:</b> {formatValue(field, resolution.theirs[field])}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="min-h-tap rounded-full bg-white/70 px-4 text-xs font-semibold"
          >
            {strings.conflict.seeBoth}
          </button>
        )}
        <button
          type="button"
          onClick={() => onChoose('mine')}
          className="min-h-tap rounded-full bg-white/70 px-4 text-xs font-semibold"
        >
          {strings.conflict.useMine}
        </button>
        <button
          type="button"
          onClick={() => onChoose('theirs')}
          className="min-h-tap rounded-full bg-white/70 px-4 text-xs font-semibold"
        >
          {strings.conflict.useTheirs}
        </button>
      </div>

      {/* Reassurance, not a warning: nothing is lost while the question is open. */}
      <p className="text-xs opacity-80">{strings.conflict.bothSaved}</p>
    </section>
  )
}
