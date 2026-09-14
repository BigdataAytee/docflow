/**
 * Is there room for the rail?
 *
 * A media QUERY rather than two navigations hidden from each other by CSS.
 * The CSS version shipped first and put both in the DOM at once — two
 * `<nav>`s with the same name and the same four links, where only the
 * engine's stylesheet decided which one a person met. In a browser that is
 * invisible; in any environment without the stylesheet it is two navigations,
 * and duplicated landmarks are exactly the kind of thing the screen-reader
 * sweep exists to catch.
 *
 * 1024px is Tailwind's `lg`, so the breakpoint here and the breakpoint in the
 * classes are the same number by construction.
 *
 * Without `matchMedia` — jsdom, an old engine — the answer is "no rail", which
 * is the phone layout: the product's primary case, and never a broken one.
 */

import { useEffect, useState } from 'react'

export const WIDE = '(min-width: 1024px)'

export function useWide(): boolean {
  const [wide, setWide] = useState<boolean>(() => globalThis.matchMedia?.(WIDE).matches ?? false)

  useEffect(() => {
    const query = globalThis.matchMedia?.(WIDE)
    if (query === undefined) return
    setWide(query.matches)
    const listen = (event: MediaQueryListEvent): void => setWide(event.matches)
    query.addEventListener('change', listen)
    return () => query.removeEventListener('change', listen)
  }, [])

  return wide
}
