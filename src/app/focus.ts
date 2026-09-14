/**
 * Announcing a route change (§V).
 *
 * In a single-page app nothing announces a navigation: the URL changes, React
 * swaps the tree, and a screen reader carries on reading the page it was
 * already on. The fix every accessibility guide lands on is to move focus to
 * the new page's main region, which announces its name and puts the reading
 * cursor at the top of the new content.
 *
 * The one thing it must not do is steal focus on FIRST paint. A fresh load
 * already starts the reader at the top of the document; interrupting to say
 * "main" cuts off the page title.
 */

import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function useAnnouncedRoute<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const { key } = useLocation()
  const navigation = useNavigationType()
  const first = useRef(true)

  useEffect(() => {
    const wasFirst = first.current
    first.current = false
    // POP on the first render is a cold load. POP later is the back button,
    // which is a navigation like any other and does need announcing.
    if (wasFirst && navigation === 'POP') return
    ref.current?.focus()
  }, [key, navigation])

  return ref
}
