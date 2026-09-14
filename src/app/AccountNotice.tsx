/**
 * "This business will be deleted", on every screen until it is not.
 *
 * A BANNER rather than a lock, and the difference matters. Locking the
 * account for the thirty days would make the window a punishment: the records
 * are not deleted yet, they are still the owner's, and Rule #6 says documents
 * are never hostage — including from the person who asked to leave and
 * changed their mind. So everything keeps working, and the way back is on
 * every screen rather than buried in the settings panel that started it.
 *
 * It is `role="status"`, not `alert`: a person who scheduled this knows they
 * scheduled it, and interrupting a screen reader mid-sentence on every
 * navigation for thirty days would be the wrong kind of loud.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCompany } from './context'
import { settingsPath } from './paths'
import { type Lifecycle, daysLeft } from '../domain/account/deletion'
import { format } from '../domain/locale/data/strings'

export function AccountNotice({ now = new Date() }: { now?: Date }) {
  const { companyId, repositories, strings } = useCompany()
  const navigate = useNavigate()
  const [lifecycle, setLifecycle] = useState<Lifecycle>({ state: 'active' })

  useEffect(() => {
    let live = true
    void repositories.account
      .lifecycle(companyId)
      .then((next) => {
        if (live) setLifecycle(next)
      })
      // A failed read is not a reason to shout. The panel is the source of
      // truth and says so plainly when it is opened.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [repositories, companyId])

  if (lifecycle.state !== 'scheduled') return null
  const d = strings.deleteAccount

  return (
    <div
      role="status"
      className="flex items-center gap-3 bg-status-bad px-4 py-2 text-xs font-semibold text-white"
    >
      <span className="min-w-0 flex-1">
        {d.scheduledTitle} · {format(d.daysLeft, { days: daysLeft(lifecycle.request, now) })}
      </span>
      <button
        type="button"
        onClick={() => navigate(settingsPath('delete'))}
        className="shrink-0 rounded-full bg-surface/20 px-3 py-1"
      >
        {d.keep}
      </button>
    </div>
  )
}
