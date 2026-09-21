/**
 * One page per type (§G) — "never combined tabs".
 *
 * "Hero card in the type colour (eyebrow DOCUMENTS, localised type name +
 * icon, count line — '4 invoices' / '3 delivery notes', inset translucent
 * '+ New {label}' button). Type-named live search below. One white list
 * container with hairline rows: reference + status badge left, amount right
 * (delivery documents show no amount), customer on the second line."
 */

import { useEffect, useMemo, useState } from 'react'

import { useCompany } from '../../app/context'
import { labelInSentence, pluralInSentence, pluralLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { EmptyState, Icon, SkeletonList, StatusBadge, TYPE_PALETTE, typeBand } from '../../ui'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import type { Money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
import type { RowActionKind } from './rowAction'
import { hasSeen, markSeen } from './seenOnce'

/** One key for the whole list page: the lesson is the same on every type. */
const HINT_KEY = 'row-actions'

export interface ListRow {
  readonly id: string
  readonly reference: string
  /**
   * True while the number is an OFFER rather than a frozen fact (§M).
   *
   * A draft now shows the number it would actually be given, the same one the
   * builder's card shows — so it has to be visibly not-yet-real, or it reads
   * as an issued number sitting in a column of issued ones.
   */
  readonly provisional?: boolean
  readonly status: string
  readonly statusLabel: string
  readonly customerName?: string
  /** Absent on a delivery document — the column does not exist there (§G). */
  readonly amount?: Money
  /**
   * What a DELIVERY shows where an amount would be — "10 cartons".
   *
   * The reference is explicit that a delivery row summarises its GOODS rather
   * than simply omitting the money. An absence tells a person nothing about
   * which delivery this is; the quantity and unit are the only summary a
   * moneyless document has.
   */
  readonly goodsSummary?: string
  /**
   * "Replaced by Rev 2", when a newer offer exists (§G). Without it a list of
   * two sent quotations cannot say which one is live — which is the exact
   * question making a Rev 2 creates.
   */
  readonly note?: string
  /**
   * The one thing this row offers to do, derived at read time (§G).
   *
   * Absent on most rows. Present, it is a JOURNEY — "Record payment" opens
   * the payment flow, "Sign" opens the signing sheet — and never a write: a
   * row that marks an invoice paid is a status changed by a thumb brushing a
   * scroll, on the one screen where the document is not in front of anybody.
   */
  readonly action?: { readonly kind: RowActionKind; readonly label: string }
}

export interface DocumentListProps {
  readonly type: DocumentType
  readonly rows: readonly ListRow[] | null
  readonly onOpen: (id: string) => void
  /**
   * Takes the owner to where the row's action happens (§G).
   *
   * A JOURNEY, never a write. The list has no business moving a status: the
   * document itself is not on screen, and §V's evidence rules mean a receipt
   * records a real payment rather than a tap on a scrolling list.
   */
  readonly onAction?: (id: string, kind: RowActionKind) => void
  readonly onNew: () => void
  /**
   * Back to Home, as the prototype draws it.
   *
   * The nav pill also reaches Home, so this is a second route to one place —
   * which is usually worth removing (Rule #1). It stays because a list is the
   * one screen reached BY drilling in, and the way back belongs where the eye
   * already is rather than at the bottom of the screen.
   */
  readonly onBack?: () => void
}

export function DocumentList({
  type,
  rows,
  onOpen,
  onAction,
  onNew,
  onBack,
}: DocumentListProps) {
  /*
   * Read ONCE at mount and never again: reading it on every render would
   * make the hint vanish mid-glance the instant it was marked seen.
   */
  const [hint] = useState(
    () => !hasSeen(HINT_KEY) && (rows ?? []).some((row) => row.action !== undefined),
  )
  useEffect(() => {
    if (hint) markSeen(HINT_KEY)
  }, [hint])

  const { profile, strings } = useCompany()
  const [query, setQuery] = useState('')

  const palette = TYPE_PALETTE[type]
  // "+ New invoice" is a sentence, so the word is cased for one (§D).
  const label = labelInSentence(profile, type)
  const plural = pluralLabel(profile, type)
  // "3 invoices", not "3 Invoices" — and cased by the table, not by a
  // `toLowerCase()` here that would be wrong the first time a language that
  // capitalises its nouns ships (§D).
  const pluralInline = pluralInSentence(profile, type)
  const showsMoney = carriesMoney(type)

  const visible = useMemo(() => {
    if (rows === null) return null
    const q = query.trim().toLocaleLowerCase()
    if (q === '') return rows
    return rows.filter((row) =>
      [row.reference, row.customerName]
        .filter((v): v is string => typeof v === 'string')
        .some((v) => v.toLocaleLowerCase().includes(q)),
    )
  }, [rows, query])

  return (
    /*
     * `pt-[max(0.875rem,env(safe-area-inset-top))]`, because this screen has
     * no coloured band above its "← Home" link — the amber card starts below
     * it — so nothing was pushing that link clear of the status bar and it
     * rendered under the clock. Same correction as `BuilderShell` and the
     * Settings panels: with the body no longer padding the page down, each
     * screen that meets the top edge clears it itself.
     */
    <section className="px-3.5 pb-[118px] pt-[max(0.875rem,env(safe-area-inset-top))]">
      {onBack !== undefined && (
        <button
          type="button"
          onClick={onBack}
          className="tap-scale mb-2.5 inline-flex min-h-tap items-center gap-1.5 text-[12.5px] font-semibold"
          style={{ color: palette.ink }}
        >
          <Icon name="arrow-left" size={1} className="flip-rtl" />
          {strings.nav.home}
        </button>
      )}

      {/*
        The hero (§G), to the prototype's measurements: a three-stop gradient
        across 140deg, a 22px radius, and a shadow made of the TYPE's own
        accent at 88 — which is what makes an amber page feel amber before a
        single word is read.
      */}
      <div
        className="sheen-strong relative overflow-hidden rounded-[22px] p-[15px] text-white"
        style={{
          backgroundImage: typeBand(palette),
          boxShadow: `0 18px 34px -10px ${palette.accent}88, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
        }}
      >
        {/*
          §G's "soft corner circle". Decorative and inert — and clipped by
          `overflow-hidden` on the parent rather than by hand, so it can hang
          off the edge without widening the page. That is not cosmetic: an
          absolutely-positioned decoration is the classic cause of a sideways
          scroll on a 360px phone.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[30px] end-[-25px] h-[118px] w-[118px] rounded-full bg-on-accent/15"
        />

        <p className="relative text-[10px] font-medium uppercase tracking-[1.5px] text-white">
          {strings.lists.eyebrow}
        </p>
        {/* Wraps rather than clipping — §F tests the longest shipped label. */}
        <h1 className="relative mb-0.5 mt-1 flex items-center gap-2 text-[21px] font-semibold leading-tight">
          <Icon name={palette.icon} size={1.3} className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{plural}</span>
        </h1>
        <p className="relative mb-[11px] text-[11.5px] text-white">
          {format(strings.lists.countLine, { count: rows?.length ?? 0, label: pluralInline })}
        </p>
        <button
          type="button"
          onClick={onNew}
          // Inset, not raised: §G calls it a translucent button INSIDE the
          // hero, and a second raised surface on a card that is already
          // lifted reads as two cards fighting.
          className="tap-scale relative inline-flex min-h-tap items-center rounded-full border border-on-accent/40 bg-on-accent-shade/25 px-[17px] text-[12.5px] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
        >
          {/*
            No plus GLYPH here: the catalogue's own string is "+ New {label}",
            so an icon beside it renders "+ + New Invoice". The FAB below is
            the one that needs a symbol, because it has no words at all.
          */}
          <span className="[overflow-wrap:anywhere]">
            {format(strings.lists.newDocument, { label })}
          </span>
        </button>
      </div>

      <label className="glass-pill my-3 flex min-h-tap items-center gap-2 rounded-full px-3.5">
        {/*
          No `sr-only` label here: the input carries `aria-label` with the
          same words, and a wrapping `<label>` whose text content repeats it
          names the field TWICE — a reader announces "the label, the label, search
          box". The reading-order sweep is what found it: the span is
          clipped off-screen, so it is heard before the input and seen after
          it, and an inversion is what a duplicate label looks like from the
          outside.
        */}
        <Icon name="search" size={0.9} className="shrink-0 opacity-70" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={format(strings.lists.searchIn, { label: plural })}
          aria-label={format(strings.lists.searchIn, { label: plural })}
          className="w-full min-w-0 border-0 bg-transparent py-2.5 text-[11.5px] outline-none placeholder:text-ink/45"
        />
      </label>

      <div>
        {visible === null && <SkeletonList rows={3} label={strings.common.loading} />}

        {visible !== null && visible.length === 0 && (
          <EmptyState
            title={rows?.length === 0 ? strings.lists.none : strings.lists.noMatch}
            {...(rows?.length === 0 ? { body: strings.lists.noneBody } : {})}
          />
        )}

        {/*
          SHOWN ONCE, and only where there is an action to explain (§G).
          
          A hint over a list with no buttons on it is a sentence about
          nothing, and a hint that comes back every week is a nag.
        */}
        {hint && (
          <p className="mb-2 rounded-xl bg-brand/[0.06] px-3 py-2 text-[11px] opacity-75" role="status">
            {strings.lists.rowActionHint}
          </p>
        )}

        {visible !== null && visible.length > 0 && (
          <ul className="glass overflow-hidden rounded-[18px]">
            {visible.map((row) => (
              <li
                key={row.id}
                className="flex items-center border-b border-brand/[0.07] last:border-0"
              >
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="flex min-h-tap flex-1 items-center gap-[11px] px-[13px] py-3 text-start"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {/*
                        MUTED WHILE IT IS ONLY AN OFFER (§M).

                        Not italic and not bracketed: the reference is read
                        character by character, and either would change the
                        glyphs somebody is trying to match. Weight and opacity
                        say "not settled yet" without touching the number, and
                        the Draft badge two millimetres to the right says the
                        rest.
                      */}
                      <span
                        {...(row.provisional === true ? { 'data-provisional': 'true' } : {})}
                        className={`truncate text-[12.5px] tabular-nums ${
                          row.provisional === true ? 'font-medium opacity-55' : 'font-semibold'
                        }`}
                      >
                        {row.reference}
                      </span>
                      <StatusBadge status={row.status} label={row.statusLabel} />
                      {/* No amount on a delivery document, in any locale (§G). */}
                      {showsMoney && row.amount !== undefined && (
                        <span className="ms-auto shrink-0 text-[12.5px] font-semibold tabular-nums">
                          {formatMoney(row.amount)}
                        </span>
                      )}
                      {/* Its goods instead, in the same place the money sits. */}
                      {!showsMoney && row.goodsSummary !== undefined && (
                        <span className="ms-auto shrink-0 text-[12.5px] font-semibold tabular-nums">
                          {row.goodsSummary}
                        </span>
                      )}
                    </span>
                    {row.customerName !== undefined && (
                      <span className="mt-0.5 block truncate text-[10px] opacity-70">
                        {row.customerName}
                      </span>
                    )}
                    {row.note !== undefined && (
                      <span className="mt-0.5 block truncate text-[10px] font-medium text-status-warn">
                        {row.note}
                      </span>
                    )}
                  </span>
                </button>

                {/*
                  THE ROW'S ONE ACTION, beside it rather than inside it.

                  §G's commonest next move for an unpaid invoice is not "open
                  it and read it", it is "the money came in" — and making
                  somebody open the document to reach a button they were
                  always going to press is three taps for one decision.

                  OUTSIDE the open-button, so it is its own target and a
                  mis-tap opens the document rather than starting a journey.
                  And it is a journey: pressing it navigates, and the status
                  moves only when somebody finishes what they were taken to.
                */}
                {row.action !== undefined && (
                  <button
                    type="button"
                    data-row-action={row.action.kind}
                    onClick={() => onAction?.(row.id, row.action!.kind)}
                    /*
                      `shrink` and a cap, not `shrink-0`.
                      
                      At 320px a reference, a badge, an amount and a fixed
                      pill do not fit on one line, and the pill was the thing
                      that would not give — so it pushed the row off the
                      edge. It may now wrap its own label to two lines inside
                      a tap-sized target, which is what a narrow phone has
                      room for.
                    */
                    className="glass-pill tap-scale me-[13px] min-h-tap max-w-[38%] shrink rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight text-brand-ink"
                  
                  >
                    {row.action.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The create button is a FAB on the list page, never in the nav (§F). */}
      <button
        type="button"
        onClick={onNew}
        aria-label={format(strings.lists.newDocument, { label })}
        className="tap-scale fixed bottom-[112px] end-4 z-10 grid h-[54px] w-[54px] place-items-center rounded-full text-white"
        style={{
          backgroundImage: typeBand(palette, 158),
          // The prototype leaves this shadow blue for every type, which is
          // the one place its own rule slips: an amber button throwing a blue
          // glow, directly under a hero that throws an amber one. Taken from
          // the type, like the hero's — the deviation is noted in PLAN.
          boxShadow: `0 16px 30px -8px ${palette.accent}99, inset 0 2px 0 rgb(255 255 255 / 0.35)`,
        }}
      >
        <Icon name="plus" size={1.6} />
      </button>
    </section>
  )
}
