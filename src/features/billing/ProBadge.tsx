/**
 * The word "Pro", on the control you meet before you start (§U).
 *
 * §U: "a gated feature announces itself **before** the user invests effort."
 * This is that announcement, and `ENTRY_POINTS` in the domain is what makes
 * "before" checkable rather than aspirational: a Pro feature with no entry
 * point cannot be gated at all.
 *
 * It renders nothing when the feature is not gated, which is every feature
 * today — §W has not drawn the line, so `proFeatures()` is empty and no badge
 * appears anywhere. That is the correct behaviour, not a placeholder.
 */

import { useCompany } from '../../app/context'

export interface ProBadgeProps {
  readonly gated: boolean
}

export function ProBadge({ gated }: ProBadgeProps) {
  const { strings } = useCompany()
  if (!gated) return null

  return (
    <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
      {strings.pro.badge}
    </span>
  )
}
