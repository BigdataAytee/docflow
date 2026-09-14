/**
 * Ctrl-K, or ⌘K on a Mac — the shortcut every palette in every tool uses, and
 * the one reason not to invent a different one.
 *
 * `event.key === 'k'` rather than a key CODE, so a keyboard laid out for
 * another language opens the palette with the key its owner reads as K.
 *
 * It never fires while a modifier-free keystroke is going into a field: the
 * guard is the modifier itself. And it is only ever a SHORTCUT — the palette
 * has a visible button too, because §V's requirement is that things work from
 * a keyboard, not that they are reachable only from one.
 */

import { useEffect } from 'react'

export function usePaletteShortcut(onOpen: () => void): void {
  useEffect(() => {
    const listen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      onOpen()
    }
    window.addEventListener('keydown', listen)
    return () => window.removeEventListener('keydown', listen)
  }, [onOpen])
}
