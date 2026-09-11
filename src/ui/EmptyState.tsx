/**
 * The empty state (§L8). Never a blank screen: a plain line about what is not
 * here yet, and the one action that changes it.
 */

import type { ReactNode } from 'react'

export interface EmptyStateProps {
  readonly title: string
  readonly body?: string
  readonly action?: ReactNode
  readonly icon?: ReactNode
}

export function EmptyState({ title, body, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 px-6 py-10 text-center">
      {icon !== undefined && <div aria-hidden="true">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      {body !== undefined && <p className="max-w-sm text-sm opacity-70">{body}</p>}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  )
}
