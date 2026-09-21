/**
 * The command palette (§Q Phase 7, §V).
 *
 * §Q names "command palette/sidebar" once, in its list of Phase-7 sweeps, and
 * no section of v6 says what either contains. So this is built from what v6
 * DOES fix, and the deviations are written down in PLAN.md rather than
 * smuggled in:
 *
 * · It adds NO destination and NO action. Every row is a route from
 *   `paths.ts` or a record already in the search index — the palette is a
 *   view of the route table, not a surface of its own. Nothing in the app is
 *   reachable only from here, so a phone user loses nothing by never opening
 *   it (Rule #1: nothing may be harder than the legacy app).
 * · Every word resolves through `src/domain/locale` (Rule #4). "Delivery
 *   note" finds the waybill list in a company that has never typed the word
 *   "waybill", because destinations are matched by §D.3's search terms.
 * · It is offline, like everything else (Rule #2): it searches records that
 *   are already loaded and navigates with the router.
 *
 * The keyboard contract is the ARIA combobox pattern rather than a roving
 * tabindex: focus stays in the field and `aria-activedescendant` moves, which
 * is what lets a person keep typing while the highlight moves — the whole
 * point of a palette.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useCompany } from '../../app/context'
import type { Destination } from '../../app/destinations'
import {
  createDestinationsAll,
  listDestinationsAll,
  navDestinations,
  settingsDestinations,
} from '../../app/destinations'
import { customerPath, documentPath } from '../../app/paths'
import { format } from '../../domain/locale/data/strings'
import { search, type IndexEntry } from '../search'

export interface CommandPaletteProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onGo: (path: string) => void
  /** The records already indexed for Home's search — never re-derived here. */
  readonly index: readonly IndexEntry[]
}

interface Row {
  readonly id: string
  readonly label: string
  readonly group: string
  readonly path: string
}

const RECORD_PATHS: Partial<Record<IndexEntry['kind'], (id: string) => string>> = {
  document: documentPath,
  customer: customerPath,
}

export function CommandPalette({ open, onClose, onGo, index }: CommandPaletteProps) {
  const { profile, strings } = useCompany()
  const p = strings.palette
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const field = useRef<HTMLInputElement>(null)
  const chosen = useRef(false)
  const listId = useId()
  const optionId = (position: number) => `${listId}-${position}`

  const destinations = useMemo(() => {
    const go: Destination[] = [
      ...navDestinations(strings),
      ...listDestinationsAll(profile, strings),
      ...settingsDestinations(strings),
    ]
    const create = createDestinationsAll(profile, strings)
    return { go, create }
  }, [profile, strings])

  const rows = useMemo((): Row[] => {
    const grouped = (items: readonly Destination[], group: string): Row[] =>
      items.map((item) => ({ id: item.id, label: item.label, group, path: item.path }))

    // An empty field is not an empty palette: it is the list of everywhere you
    // can go, which is what makes the thing discoverable the first time.
    if (query.trim() === '') {
      return [
        ...grouped(destinations.go, p.goTo),
        ...grouped(destinations.create, p.create),
      ]
    }

    const records = search(index, query, 8)
      .map((entry): Row | null => {
        const toPath = RECORD_PATHS[entry.kind]
        // A saved ITEM is indexed for Home's search but has no page of its
        // own, so it is not offered here. A row that goes nowhere is worse
        // than a row that is missing.
        return toPath === undefined
          ? null
          : { id: `${entry.kind}:${entry.id}`, label: entry.label, group: p.records, path: toPath(entry.id) }
      })
      .filter((row): row is Row => row !== null)

    return [
      ...grouped(search(destinations.go, query, 6), p.goTo),
      ...grouped(search(destinations.create, query, 4), p.create),
      ...records,
    ]
  }, [query, destinations, index, p])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    chosen.current = false
    setQuery('')
    setActive(0)
    field.current?.focus()

    return () => {
      // Focus goes back to whatever opened the palette — but ONLY when it was
      // dismissed. Choosing a row navigates, and the route change moves focus
      // to the new page's main landmark so a screen reader hears where it
      // landed; handing focus back to the button would talk over that.
      if (chosen.current) return
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const move = (delta: number) => {
    if (rows.length === 0) return
    setActive((was) => (was + delta + rows.length) % rows.length)
  }

  const choose = (row: Row | undefined) => {
    if (row === undefined) return
    chosen.current = true
    onGo(row.path)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[10vh] backdrop-blur-sm"
      // A click on the backdrop closes, the same as Escape. The overlay is
      // not a control and carries no role: the dialog below is the thing.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            move(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            move(-1)
          } else if (event.key === 'Enter') {
            event.preventDefault()
            choose(rows[active])
          } else if (event.key === 'Tab') {
            // Trapped. There is one focusable thing in here by design — the
            // field — so Tab has nowhere useful to go and every other key
            // still reaches the list through aria-activedescendant.
            event.preventDefault()
          }
        }}
      >
        <input
          ref={field}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          // The FIELD's name, not the dialog's. All three — dialog, field and
          // list — were `p.title`, so opening the palette announced "Go
          // anywhere" three times before saying anything useful.
          aria-label={p.placeholder}
          {...(rows[active] === undefined ? {} : { 'aria-activedescendant': optionId(active) })}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={p.placeholder}
          className="min-h-tap w-full border-b border-edge/10 bg-transparent px-4 text-sm outline-none"
        />

        <p className="sr-only" role="status" aria-live="polite">
          {format(p.resultCount, { count: rows.length })}
        </p>

        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm opacity-70">{p.noMatch}</p>
        ) : (
          <ul id={listId} role="listbox" aria-label={p.results} className="max-h-[50vh] overflow-y-auto">
            {rows.map((row, position) => (
              <li
                key={row.id}
                id={optionId(position)}
                role="option"
                aria-selected={position === active}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(row)
                }}
                onMouseEnter={() => setActive(position)}
                className={`flex min-h-tap cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                  position === active ? 'bg-brand-tint' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide ">
                  {row.group}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
