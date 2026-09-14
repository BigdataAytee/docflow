/**
 * Who knows whether the app may ask to be rated (§T, §R, §N).
 *
 * Three facts decide it and none of them belongs to the screen where the
 * happy moment happens: whether this is a demo (§R), whether the account is
 * on its way out, and whether the platform has a review API at all. So the
 * screen reports the MOMENT — "a share was handed off" — and this decides.
 *
 * `useReview` falls back to a no-op rather than throwing, so a component can
 * report a moment without every test that renders it mounting a host. The
 * same arrangement the theme and the palette use.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useCompany } from './context'
import type { Moment } from '../domain/ratings/prompt'
import { createWebReviewPort, maybeAskForReview } from '../features/ratings'

interface Review {
  readonly report: (moment: Moment) => void
}

const ReviewContext = createContext<Review | null>(null)

export function useReview(): Review {
  return useContext(ReviewContext) ?? { report: () => undefined }
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const { companyId, repositories, isDemo } = useCompany()
  const port = useMemo(() => createWebReviewPort(), [])
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let live = true
    void repositories.account
      .lifecycle(companyId)
      .then((state) => {
        if (live) setLeaving(state.state === 'scheduled')
      })
      // A failed read means the app does not know, and not knowing is a
      // reason not to ask rather than a reason to ask anyway.
      .catch(() => {
        if (live) setLeaving(true)
      })
    return () => {
      live = false
    }
  }, [repositories, companyId])

  const report = useCallback(
    (moment: Moment) => {
      // Fire and forget, deliberately: nothing a person is doing may ever
      // wait on a rating prompt.
      void maybeAskForReview({ moment, port, isDemo, deletionScheduled: leaving })
    },
    [port, isDemo, leaving],
  )

  const value = useMemo(() => ({ report }), [report])
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>
}
