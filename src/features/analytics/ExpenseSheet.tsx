/**
 * The `+` sheet on the analytics page (§G, §L6).
 *
 * "A three-field sheet or receipt photo." Amount, date, and what it was for —
 * with the receipt photo standing in for the last of the three, never for the
 * amount (Rule #3: money is never inferred). The sheet says so in a line, so
 * nobody photographs a receipt expecting the figure to appear.
 *
 * Category is offered, never required (Rule #1: no new required fields, ever).
 */

import { useId, useState } from 'react'

import { useCompany } from '../../app/context'
import { PhotoButton } from '../photos/PhotoButton'
import { money, type Money } from '../../domain/money/money'
import { minorUnitsFor } from '../../domain/locale/bank-fields'
import { useFocusOnOpen } from '../../ui'

export interface ExpenseSheetProps {
  readonly currency: string
  readonly today: string
  readonly knownCategories: readonly string[]
  readonly onSave: (input: {
    amount: Money
    spentOn: string
    description: string
    category?: string
    photoAssetId?: string
  }) => void
  readonly onCancel: () => void
  /**
   * Stores the photo and returns its asset id.
   *
   * This was `onAttachPhoto`, optional, with a comment saying Phase 4 would
   * wire the camera — and nothing ever passed it, so §G's "three-field sheet
   * OR receipt photo" was only ever three fields. There was no camera to
   * wait for: `capture="environment"` opens one, in a WebView too.
   */
  readonly onStorePhoto?: (dataUrl: string) => Promise<string>
}

export function ExpenseSheet({
  currency,
  today,
  knownCategories,
  onSave,
  onCancel,
  onStorePhoto,
}: ExpenseSheetProps) {
  // Opening this panel moves focus into it, and its name is announced.
  const panel = useFocusOnOpen<HTMLElement>()
  const { strings } = useCompany()
  const ids = useId()

  const [major, setMajor] = useState('')
  const [spentOn, setSpentOn] = useState(today)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [photoAssetId, setPhotoAssetId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const scale = minorUnitsFor(currency)
  const parsed = Number.parseFloat(major.replace(/,/g, ''))
  const minor = Number.isFinite(parsed) ? Math.round(parsed * scale) : 0
  const hasEvidence = description.trim() !== '' || photoAssetId !== null
  const canSave = minor > 0 && hasEvidence

  function save() {
    if (!canSave) return
    const trimmedCategory = category.trim()
    onSave({
      amount: money(currency, minor),
      spentOn,
      description: description.trim(),
      ...(trimmedCategory === '' ? {} : { category: trimmedCategory }),
      ...(photoAssetId === null ? {} : { photoAssetId }),
    })
  }

  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="glass rounded-2xl p-4 outline-none"
      aria-label={strings.expenses.add}
    >
      <label className="block text-xs font-medium opacity-70" htmlFor={`${ids}-amount`}>
        {strings.expenses.amount}
      </label>
      <input
        id={`${ids}-amount`}
        className="mt-1 w-full rounded-xl border border-edge/10 bg-surface px-3 py-2 text-lg tabular-nums"
        inputMode="decimal"
        value={major}
        onChange={(event) => setMajor(event.target.value)}
      />
      <p className="mt-1 text-[11px] opacity-70">{strings.expenses.photoNeverSetsAmount}</p>

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-date`}>
        {strings.expenses.date}
      </label>
      <input
        id={`${ids}-date`}
        type="date"
        className="mt-1 w-full rounded-xl border border-edge/10 bg-surface px-3 py-2"
        value={spentOn}
        onChange={(event) => setSpentOn(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-what`}>
        {strings.expenses.whatFor}
      </label>
      <input
        id={`${ids}-what`}
        className="mt-1 w-full rounded-xl border border-edge/10 bg-surface px-3 py-2"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <label className="mt-3 block text-xs font-medium opacity-70" htmlFor={`${ids}-category`}>
        {strings.expenses.category}
      </label>
      <input
        id={`${ids}-category`}
        className="mt-1 w-full rounded-xl border border-edge/10 bg-surface px-3 py-2"
        list={`${ids}-categories`}
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      />
      <datalist id={`${ids}-categories`}>
        {knownCategories.map((known) => (
          <option key={known} value={known} />
        ))}
      </datalist>

      {onStorePhoto !== undefined && (
        <div className="mt-3">
          <PhotoButton
            label={
              photoAssetId === null ? strings.expenses.attachPhoto : strings.expenses.photoAttached
            }
            {...(photoUrl === null ? {} : { currentUrl: photoUrl })}
            onPhoto={async (dataUrl) => {
              const assetId = await onStorePhoto(dataUrl)
              setPhotoAssetId(assetId)
              // Shown, not just announced: §G lets the photo stand in for the
              // description, and an owner cannot tell whether the right
              // receipt is attached from the word "attached".
              setPhotoUrl(dataUrl)
            }}
          />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl px-3 py-2.5 text-sm font-medium opacity-70"
          onClick={onCancel}
        >
          {strings.common.cancel}
        </button>
        <button
          type="button"
          className="raised tap-scale flex-1 rounded-xl bg-gradient-to-b from-brand-light to-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
          disabled={!canSave}
          onClick={save}
        >
          {strings.expenses.save}
        </button>
      </div>
    </section>
  )
}
