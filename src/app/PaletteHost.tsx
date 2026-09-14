/**
 * Where the command palette lives, and how anything else opens it.
 *
 * Above the routes rather than inside the Shell, for a reason that shows up
 * the first time somebody tries it: the builder and the welcome page are
 * full-screen routes OUTSIDE the Shell (§G), and a palette that stopped
 * working on the screen where you spend the most time would be worse than no
 * palette. It is app-wide or it is a gimmick.
 *
 * `usePalette` falls back to a no-op rather than throwing, so a component can
 * offer the button without every test that renders it having to mount the
 * host — the same arrangement the theme uses.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppData } from './store'
import { useSearchIndex } from './useSearchIndex'
import { customerNames } from './derive'
import { CommandPalette, usePaletteShortcut } from '../features/palette'

interface PaletteControl {
  readonly open: () => void
}

const PaletteContext = createContext<PaletteControl | null>(null)

export function usePalette(): PaletteControl {
  return useContext(PaletteContext) ?? { open: () => undefined }
}

export function PaletteProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { customers } = useAppData()
  const names = useMemo(() => customerNames(customers), [customers])
  const index = useSearchIndex(names)

  const [open, setOpen] = useState(false)
  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => setOpen(false), [])
  usePaletteShortcut(show)

  const control = useMemo(() => ({ open: show }), [show])

  return (
    <PaletteContext.Provider value={control}>
      {children}
      <CommandPalette open={open} onClose={hide} onGo={navigate} index={index} />
    </PaletteContext.Provider>
  )
}
