/**
 * The way out (§S, §V, Rule #6; Apple 5.1.1(v)).
 *
 * Three things this screen refuses to be. It is not a "deactivate" — the rule
 * that requires it says deactivation alone is insufficient, and the copy says
 * deleted because it means deleted. It is not a dark pattern — cancelling is
 * one tap and typing the business name is the only friction, and that friction
 * exists to stop a mis-tap rather than to stop a decision. And it does not
 * hold the export hostage: Rule #6 says export is free forever, so the
 * archive is OFFERED on the way out and an owner who declines still leaves.
 */

import { useState } from 'react'

import { GRACE_DAYS, type Lifecycle, type Refusal, type Role, daysLeft } from '../../domain/account/deletion'
import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'

export interface DeleteAccountProps {
  readonly lifecycle: Lifecycle
  readonly companyName: string
  readonly role: Role
  readonly now: Date
  readonly onExport: () => void
  readonly exported: boolean
  readonly onRequest: (typedName: string) => void
  readonly onCancel: () => void
  readonly refusal?: Refusal
}

export function DeleteAccount({
  lifecycle,
  companyName,
  role,
  now,
  onExport,
  exported,
  onRequest,
  onCancel,
  refusal,
}: DeleteAccountProps) {
  const { strings } = useCompany()
  const d = strings.deleteAccount
  const [typed, setTyped] = useState('')

  if (lifecycle.state === 'scheduled') {
    const left = daysLeft(lifecycle.request, now)
    return (
      <section className="space-y-3 px-4 py-4" aria-label={d.scheduledTitle}>
        <h1 className="text-lg font-bold text-status-bad">{d.scheduledTitle}</h1>
        {/*
          A DATE, not "in a while". A person can act on a date, and the rule
          that permits a delayed deletion is explicit that they must be told
          how long it takes.
        */}
        <p className="text-sm font-semibold tabular-nums">
          {new Date(lifecycle.request.purgeAfter).toISOString().slice(0, 10)} ·{' '}
          {format(d.daysLeft, { days: left })}
        </p>
        <p className="text-sm opacity-80">{d.scheduledBody}</p>

        <button
          type="button"
          onClick={onCancel}
          className="raised tap-scale min-h-tap w-full rounded-xl bg-gradient-to-b from-brand-light to-brand text-sm font-semibold text-white"
        >
          {d.keep}
        </button>

        {/* Still free, still now. A lapsed or ending account is never a
            reason to withhold somebody's own records (Rule #6). */}
        <button
          type="button"
          onClick={onExport}
          className="min-h-tap w-full rounded-xl bg-surface text-sm font-semibold"
        >
          {d.exportAction}
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-3 px-4 py-4" aria-label={d.title}>
      <h1 className="text-lg font-bold">{d.title}</h1>
      <p className="text-sm opacity-80">{d.body}</p>

      <ul className="glass space-y-1 rounded-2xl p-3 text-xs">
        <li>{d.whatGoes}</li>
        <li>{d.whatStays}</li>
      </ul>

      {role !== 'owner' ? (
        // Said plainly rather than hidden: a control that is absent teaches
        // nothing, and §P's rule is worth stating to the person it stops.
        <p className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm text-status-warn" role="status">
          {d.ownerOnly}
        </p>
      ) : (
        <>
          <p className="text-sm opacity-80">{d.exportFirst}</p>
          <button
            type="button"
            onClick={onExport}
            className="min-h-tap w-full rounded-xl bg-surface text-sm font-semibold"
          >
            {exported ? d.exportDone : d.exportAction}
          </button>

          <label className="block">
            <span className="text-xs font-medium opacity-70">{d.typeName}</span>
            <input
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-label={d.typeName}
              autoComplete="off"
              className="mt-1 min-h-tap w-full rounded-xl border border-edge/10 bg-surface px-3 text-sm"
            />
          </label>

          {refusal === 'name_mismatch' && (
            <p className="text-sm font-medium text-status-bad" role="alert">
              {d.nameMismatch}
            </p>
          )}

          <button
            type="button"
            onClick={() => onRequest(typed)}
            // Disabled until the name matches, so the destructive tap cannot
            // be the one that discovers the rule. `GRACE_DAYS` is in the
            // label because the number a person is told and the number the
            // purge counts to must be the same number.
            disabled={typed.trim().toLocaleLowerCase() !== companyName.trim().toLocaleLowerCase()}
            className="min-h-tap w-full rounded-xl bg-status-bad text-sm font-semibold text-white disabled:opacity-40"
          >
            {format(d.confirm, { days: GRACE_DAYS })}
          </button>
        </>
      )}
    </section>
  )
}
