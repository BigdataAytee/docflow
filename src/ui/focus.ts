/**
 * Moving focus when the screen changes under a person (§V).
 *
 * A sighted user sees a panel appear. A screen-reader user is told nothing:
 * the reading cursor stays where it was, and on this app it was often worse
 * than that — the button that opened the panel UNMOUNTS when the panel takes
 * its place, so focus falls back to `<body>` and the next Tab starts again
 * from the top of the page. The panel is on screen and unreachable without
 * hunting for it.
 *
 * So an opened panel takes focus. It is a `<section>` with a name, which is
 * what makes this work: taking focus announces that name, which is the panel's
 * title, which is exactly what a person needs to hear.
 */

import { useEffect, useRef } from 'react'

/**
 * Focus this element when it appears, and hand focus back when it goes away.
 *
 * The hand-back is best effort by design: it only works when the element that
 * had focus is still in the document, which is true for a panel opened from a
 * button that stays put and false for one that replaces its own trigger. It
 * does the right thing where it can rather than nothing everywhere.
 */
export function useFocusOnOpen<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const previous = document.activeElement
    ref.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return ref
}
