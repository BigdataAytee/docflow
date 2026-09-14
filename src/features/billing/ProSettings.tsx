/**
 * "One quiet 'DocFlow Pro' row in Settings" (§U).
 *
 * Quiet is the specification, so this is a row that says where you stand and
 * offers the two things §U requires — Manage plan, which deep-links to the
 * store's own subscription UI, and Restore purchases, which is "always
 * present". Neither can do anything until Phase 4's native billing exists, so
 * both say so rather than looking live (§N).
 *
 * The notices are the other half of §U's honesty: grace and lapse are stated
 * in one calm line each, with no data loss and nothing locked (Rule #6).
 */

import type { Standing } from '../../domain/billing/entitlement'
import { noticeFor } from '../../domain/billing/entitlement'
import { useCompany } from '../../app/context'
import { format } from '../../domain/locale/data/strings'

export interface ProSettingsProps {
  readonly standing: Standing
  /** False until Phase 4 wires StoreKit and Play. Said, never hidden. */
  readonly billingAvailable: boolean
  readonly onManage: () => void
  readonly onRestore: () => void
}

export function ProSettings({
  standing,
  billingAvailable,
  onManage,
  onRestore,
}: ProSettingsProps) {
  const { strings } = useCompany()
  const p = strings.pro
  const notice = noticeFor(standing)

  return (
    <section className="space-y-3 px-4 py-4" aria-label={p.settingsRow}>
      <h1 className="text-lg font-bold">{p.name}</h1>

      <p className="text-sm font-medium">
        {standing.plan === 'pro' ? p.name : p.free}
      </p>

      {notice === 'grace' && standing.standing === 'grace' && (
        // Calm, and with a date on it. §U: "a calm one-line notice, no data
        // loss, no locked documents."
        <p className="rounded-xl bg-status-warn-tint px-3 py-2.5 text-sm text-status-warn" role="status">
          {format(p.graceNotice, { date: standing.graceEndsAt.slice(0, 10) })}
        </p>
      )}
      {notice === 'lapsed' && (
        <p className="rounded-xl bg-ink/5 px-3 py-2.5 text-sm" role="status">
          {p.lapsedNotice}
        </p>
      )}

      <p className="text-xs opacity-70">{p.freeForever}</p>

      <button
        type="button"
        onClick={onManage}
        disabled={!billingAvailable}
        className="min-h-tap w-full rounded-xl bg-surface text-sm font-semibold disabled:opacity-40"
      >
        {p.managePlan}
      </button>

      {/*
        §U: "Restore purchases is always present." Present, and honestly
        disabled until there is a store to restore from — §N's rule that an
        unavailable capability is stated plainly rather than dressed up.
      */}
      <button
        type="button"
        onClick={onRestore}
        disabled={!billingAvailable}
        className="min-h-tap w-full rounded-xl bg-surface text-sm font-semibold disabled:opacity-40"
      >
        {p.restore}
      </button>
    </section>
  )
}
