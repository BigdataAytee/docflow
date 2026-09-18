/**
 * The way back off a detail screen (§G).
 *
 * Every detail screen needs one now that primary navigation is confined to
 * the top level, and they all need the SAME one: back to wherever the person
 * came from, so Customers → customer → invoice → Back reaches the customer
 * and not Home.
 *
 * WHICH `history.back()` ALONE DOES NOT GIVE YOU. A document can be opened
 * with no history behind it at all — a shared link, a notification, a cold
 * start restoring a route — and `navigate(-1)` on the first entry in the
 * stack does nothing. The control looks live, the person taps it, and the
 * screen sits there.
 *
 * So: go back when there is a back to go to, and otherwise go somewhere
 * sensible. `location.key` is React Router's own answer to the question — it
 * is the literal string `'default'` on the entry the app started at and a
 * generated key on every entry pushed since.
 */

import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * @param fallback where to go when this screen IS the first entry. A path,
 *   not `-1`: the caller knows which list or section this screen belongs
 *   under, and that is a better answer than Home for every screen that has
 *   one.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    if (location.key === 'default') {
      // Nothing behind us. `replace` so the fallback does not become a second
      // entry that Back then returns to — which would be a loop.
      navigate(fallback, { replace: true })
      return
    }
    navigate(-1)
  }, [navigate, location.key, fallback])
}
