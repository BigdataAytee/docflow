/**
 * Home (§G) — "the only place all four types appear together".
 *
 * Exactly two stat cards, four type tiles, a search field, and the two or
 * three things that want doing. The connectivity pill is truthful: it is
 * driven by real connection plus pending work, never by a simulated toggle.
 *
 * Laid out from `docs/design-reference/prototype.html`, which is the
 * pixel-level authority for these surfaces. Three things in it are not what
 * a reading of §F alone would produce, and each is deliberate:
 *
 * · **The stat cards are INSIDE the header**, not overlapping its lower
 *   edge — translucent white on the blue, with a lit top border. That is why
 *   the header can end in a plain rounded edge and a blue shadow: there is
 *   nothing straddling it that needs the join disguised.
 * · **The type tiles are LIGHT**, not saturated blocks of the type colour.
 *   Each is a glass pane washed with its type's tint, carrying a tinted icon
 *   square, a count chip and dark text. Four solid colour blocks would be
 *   the loudest thing on the screen; §G wants the two figures above them to
 *   be.
 * · **The count is a chip in the corner**, which is also what makes the tile
 *   legible at 200% text: the number never competes with the label for the
 *   same line.
 *
 * The Voice and Scan controls §G places here render only when this screen is
 * given something for them to DO. They are absent by default, and that is a
 * deliberate deviation from the drawing: §N is explicit that an unavailable
 * capability is stated plainly rather than dressed up, and a round microphone
 * that opens nothing is the dressed-up version. The slot is here, in the
 * place and shape the prototype draws; Phase 6 supplies the handlers.
 */

import type { CSSProperties, ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { pluralLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { ConnectivityPill, Icon, TYPE_PALETTE } from '../../ui'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import type { CurrencyCode, Money } from '../../domain/money/money'
import { formatMoney, formatMoneyCompact } from '../customers/formatMoney'
import type { AttentionItem } from './stats'
import { SetupChecklist } from './SetupChecklist'
import type { ChecklistItem, ChecklistItemId } from '../onboarding/checklist'

export interface HomeProps {
  readonly businessName: string
  readonly userName: string
  readonly now: Date
  readonly online: boolean
  readonly pendingCount: number
  readonly failedCount: number
  readonly outstanding: ReadonlyMap<CurrencyCode, Money>
  readonly received: ReadonlyMap<CurrencyCode, Money>
  readonly counts: Readonly<Record<DocumentType, number>>
  readonly attention: readonly AttentionItem[]
  readonly onOpenType: (type: DocumentType) => void
  readonly onOpenDocument: (id: string) => void
  readonly onSearch: (query: string) => void
  /** The company's logo, once there is one. §G's holder is empty until then. */
  readonly logoUrl?: string
  /** Where "Tap to add your logo" goes. Absent leaves the holder inert. */
  readonly onAddLogo?: () => void
  readonly onLogOut?: () => void
  /**
   * §G's two round controls. Always rendered now, per the accepted
   * reference — and what they DO when a model is not installed is say so
   * (§N), never a success message for work that did not happen.
   */
  readonly onVoice?: () => void
  readonly onScan?: () => void
  /** §N's honest line, shown under the controls once one is pressed. */
  readonly captureNotice?: string
  /**
   * §L4's bounded catch-up, said out loud. Absent when nothing was dropped —
   * and never an empty string, so "no months skipped" cannot render as a
   * blank notice claiming something happened.
   */
  readonly repeatsSkipped?: readonly string[]
  /** §18's "Your next steps". Absent once finished or dismissed. */
  readonly setup?: {
    readonly items: readonly ChecklistItem[]
    readonly onStart: (id: ChecklistItemId) => void
    readonly onGuide: () => void
    readonly onHide: () => void
  }
  /**
   * §G: "typing replaces the body with results". When this is present the
   * tiles and the attention list step aside for it — the header, the stat
   * cards and the field itself stay, so the way back is always on screen.
   */
  readonly searchQuery?: string
  readonly results?: ReactNode
}

/**
 * The tile class per type, written out in full.
 *
 * Not `tile-${type}`. Tailwind scans the SOURCE for class names and drops any
 * component-layer class it cannot find there, so a name assembled at runtime
 * is a name that ships as nothing — the tiles rendered white, with every
 * colour variable undefined. Spelling them out is what makes them survive the
 * build, and it is also the only form a reader can grep.
 */
const TILE_CLASS: Readonly<Record<DocumentType, string>> = {
  invoice: 'tile-invoice',
  quotation: 'tile-quotation',
  receipt: 'tile-receipt',
  waybill: 'tile-waybill',
}

function greeting(now: Date, strings: ReturnType<typeof useCompany>['strings']): string {
  const hour = now.getHours()
  if (hour < 12) return strings.home.greetingMorning
  if (hour < 17) return strings.home.greetingAfternoon
  return strings.home.greetingEvening
}

/**
 * One of §G's two figures, on the header's blue.
 *
 * Translucent white over the accent rather than a glass pane, because it is
 * INSIDE the header: a frosted card here would be a pane floating on a pane.
 */
function StatCard({
  title,
  amounts,
  emptyLabel,
  tone,
}: {
  title: string
  amounts: ReadonlyMap<CurrencyCode, Money>
  emptyLabel: string
  /** `in` is money that arrived, and reads green; `owed` keeps brand blue. */
  tone: 'in' | 'owed'
}) {
  const entries = [...amounts.entries()].filter(([, amount]) => amount.minor !== 0)

  return (
    <section
      // `min-w-0` because a flex item defaults to `min-width: auto` and will
      // not shrink below its content — so at 200% text these two cards pushed
      // the page 208px wider than the phone. Found by the large-text sweep.
      className="stat-card min-w-0 flex-1 rounded-[15px] px-2.5 py-3 text-start"
      aria-label={title}
    >
      {entries.length === 0 ? (
        <p className="text-[23px] font-semibold leading-tight opacity-40">{emptyLabel}</p>
      ) : (
        // One line per currency — never a combined figure (§G, §V).
        entries.map(([currency, amount]) => (
          <p
            key={currency}
            className="text-[23px] font-semibold leading-tight tabular-nums"
            // Money that ARRIVED is green; money still owed keeps the brand
            // blue. Tokens rather than literals: the green is a 23px NUMBER
            // and has to stay legible on a dark card, which the light value
            // does not.
            style={{ color: tone === 'in' ? 'var(--money-in)' : 'var(--money-owed)' }}
          >
            {/*
              Shortened on screen, EXACT to a reader. "₦324K" fits the card
              and tells you the shape of the number; it does not tell you
              whether you are owed ₦323,500 or ₦324,499, and somebody using
              a screen reader should not be the only one who cannot find out.
              The full figure is one tap away on the list either way.
            */}
            <span aria-hidden="true">{formatMoneyCompact(amount)}</span>
            <span className="sr-only">{formatMoney(amount)}</span>
          </p>
        ))
      )}
      <p className="mt-0.5 text-[10.5px] font-medium text-stat-label">{title}</p>
    </section>
  )
}

/**
 * §G's logo holder: "white rounded square with a thin inner margin; the logo
 * scales to touch the margin — square nearly fills, wide spans width, tall
 * runs height — never cropped."
 *
 * `object-contain` is the whole of "never cropped", and it is the reason this
 * is an `<img>` in a padded box rather than a background image: a background
 * would need `contain` restated at every size, and `cover` is one word away.
 */
function LogoHolder({
  logoUrl,
  label,
  onAdd,
}: {
  logoUrl?: string
  label: string
  onAdd?: () => void
}) {
  const inner =
    logoUrl === undefined ? (
      <Icon name="photo" size={1.05} className="opacity-40" />
    ) : (
      <img src={logoUrl} alt="" className="h-full w-full object-contain" />
    )

  const box =
    'grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-xl bg-on-accent p-[3px] text-ink'
  const lift: CSSProperties = {
    boxShadow: '0 4px 12px rgba(9,15,45,.35), inset 0 1px 0 #fff',
  }

  // Inert when there is nowhere to go — and then not a button at all, rather
  // than a button that does nothing when pressed.
  if (onAdd === undefined) {
    return (
      <span aria-hidden="true" className={box} style={lift}>
        {inner}
      </span>
    )
  }

  return (
    <button type="button" onClick={onAdd} aria-label={label} className={`${box} tap-scale`} style={lift}>
      {inner}
    </button>
  )
}

export function Home({
  businessName,
  userName,
  now,
  online,
  pendingCount,
  failedCount,
  outstanding,
  received,
  counts,
  attention,
  onOpenType,
  onOpenDocument,
  onSearch,
  logoUrl,
  onAddLogo,
  onLogOut,
  onVoice,
  onScan,
  captureNotice,
  repeatsSkipped,
  setup,
  searchQuery,
  results,
}: HomeProps) {
  const { profile, strings } = useCompany()

  return (
    <div className="pb-[118px]">
      {/*
        Home's header, SOFTENED — the one surface where the accepted
        reference overrules the earlier prototype outright. A later
        stylesheet repaints `#vHome > .hd` pale, turns its text navy, and
        hides both decorations with `#vHome > .hd > span { display: none }`.
        So the corner circle and the travelling sheen are not omitted here;
        they were taken out.
      */}
      <header className="header-soft relative overflow-hidden rounded-b-[30px] p-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="relative flex items-center gap-2.5">
          <LogoHolder
            {...(logoUrl === undefined ? {} : { logoUrl })}
            label={strings.home.addLogo}
            {...(onAddLogo === undefined ? {} : { onAdd: onAddLogo })}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold">{businessName}</p>
            {/*
              §G's "Tap to add your logo until one is set". It is a hint for
              the control beside it, which already carries that same sentence
              as its name — so this copy is hidden from a reader rather than
              announced twice.
            */}
            {logoUrl === undefined && (
              <p aria-hidden="true" className="truncate text-[9.5px] text-header-muted">
                {strings.home.addLogo}
              </p>
            )}
          </div>

          <ConnectivityPill
            online={online}
            pendingCount={pendingCount}
            failedCount={failedCount}
            labels={{
              saved_local: strings.sync.savedLocal,
              waiting: strings.sync.waiting,
              uploaded: strings.sync.uploaded,
              needs_review: strings.sync.needsReview,
            }}
          />

          {onLogOut !== undefined && (
            <button
              type="button"
              onClick={onLogOut}
              aria-label={strings.home.logOut}
              className="tap-scale grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-on-accent/45 text-header-muted"
            >
              <Icon name="logout" size={0.9} />
            </button>
          )}
        </div>

        {/*
          The page's h1. It was a paragraph, so Home — the app's first screen —
          opened with a level-2 heading and nothing above it, and a reader
          jumping by heading could not tell where the page began. The biggest
          line on the screen is now also the biggest line in the outline.
        */}
        <h1 className="relative mb-0.5 mt-3 text-[17px] font-semibold">
          {greeting(now, strings)}
          {userName === '' ? '' : `, ${userName}`}
        </h1>
        <p className="relative mb-3 text-[11px] text-header-muted">{strings.home.greetingLine}</p>

        <div className="relative flex gap-2.5">
          <StatCard
            title={strings.home.outstanding}
            amounts={outstanding}
            emptyLabel={strings.home.nothingOutstanding}
            tone="owed"
          />
          <StatCard
            title={strings.home.receivedThisMonth}
            amounts={received}
            emptyLabel={strings.home.nothingReceived}
            tone="in"
          />
        </div>
      </header>

      <div className="px-3.5 pt-[13px]">
        <label className="glass-pill flex min-h-tap items-center gap-2 rounded-full px-3.5">
          {/*
            No `sr-only` label here: the input carries `aria-label` with the
            same words, and a wrapping `<label>` whose text content repeats it
            names the field TWICE — a reader announces "the label, the label, search
            box". The reading-order sweep is what found it: the span is
            clipped off-screen, so it is heard before the input and seen after
            it, and an inversion is what a duplicate label looks like from the
            outside.
          */}
          <Icon name="search" size={0.95} className="shrink-0 opacity-45" />
          <input
            type="search"
            value={searchQuery ?? ''}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={strings.home.searchEverything}
            aria-label={strings.home.searchEverything}
            className="w-full min-w-0 border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-ink/45"
          />
        </label>
      </div>

      {/* §G: typing replaces the body. The header, the stat cards and the
          field above stay put, so there is always a way back. */}
      {results ?? (
        <div className="px-3.5">
          {/* §18's checklist, above the capture controls as the reference has it. */}
          {setup !== undefined && (
            <SetupChecklist
              items={setup.items}
              onStart={setup.onStart}
              onGuide={setup.onGuide}
              onHide={setup.onHide}
            />
          )}

          {/*
            §G's two round controls, at either end of the row.
            
            They are always here now. What changes with the §N capability
            ladder is what they SAY: with no model installed they explain
            that plainly rather than pretending to record anything.
          */}
          <div className="my-3 flex justify-between px-0.5">
            <button
              type="button"
              onClick={onVoice}
              aria-label={strings.common.voice}
              className="raised-soft tap-scale grid h-11 w-11 place-items-center rounded-full border border-on-accent/90 text-brand"
              style={{ backgroundImage: 'linear-gradient(180deg,#fff,#e9eeff)' }}
            >
              <Icon name="microphone" size={1.25} />
            </button>
            <button
              type="button"
              onClick={onScan}
              aria-label={strings.common.scan}
              className="raised-soft tap-scale grid h-11 w-11 place-items-center rounded-full border border-on-accent/90 text-brand"
              style={{ backgroundImage: 'linear-gradient(180deg,#fff,#e9eeff)' }}
            >
              <Icon name="camera" size={1.25} />
            </button>
          </div>

          {/*
            The months a long offline gap dropped. §L4 bounds the catch-up
            rather than dumping five years of drafts into the list, and
            requires the ones it skipped to be NAMED — an owner should be
            told, not left to count backwards and find eleven missing.
          */}
          {repeatsSkipped !== undefined && repeatsSkipped.length > 0 && (
            <p
              role="status"
              className="mb-3 rounded-xl bg-status-warn-tint px-3 py-2 text-[10.5px] leading-relaxed text-status-warn"
            >
              {format(strings.home.repeatsSkipped, {
                count: repeatsSkipped.length,
                months: repeatsSkipped.join(', '),
              })}
            </p>
          )}

          {captureNotice !== undefined && (
            <p
              role="status"
              className="mb-3 rounded-xl bg-status-warn-tint px-3 py-2 text-[10.5px] leading-relaxed text-status-warn"
            >
              {captureNotice}
            </p>
          )}

          <ul className="grid grid-cols-2 gap-3 pt-3">
            {DOCUMENT_TYPES.map((type) => {
              const palette = TYPE_PALETTE[type]
              return (
                // `min-w-0` for the same reason as the stat cards above: a
                // GRID item also defaults to `min-width: auto`, so the widest
                // label held the column open and `break-words` never got the
                // chance to wrap it.
                <li key={type} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenType(type)}
                    data-type-card={type}
                    // Read aloud, the plate and the chip run together as
                    // "Invoice 3", which sounds like a reference number. The
                    // count line says it properly in every language.
                    //
                    // The STANDALONE plural here, not the sentence form: this
                    // is the accessible NAME of a control, and a name should
                    // be the word the tile visibly says. The sentence form
                    // belongs where the count line is prose — the list hero.
                    aria-label={format(strings.lists.countLine, {
                      count: counts[type],
                      label: pluralLabel(profile, type),
                    })}
                    // The five colours a tile carries are keyed by the
                    // INTERNAL type in `src/index.css`, so they flip with the
                    // theme. Inline they could not — and a hex reached
                    // through a variable is invisible to the dark-mode sweep,
                    // so this is the one place where the class IS the check.
                    /*
                      BIGGER, because these four are the front door.
                      
                      `min-h` rather than a fixed height: the floor is what a
                      thumb needs, and the card grows past it when a label
                      wraps to three lines at 200% text. A fixed height would
                      clip "Bons de livraison" — the longest label any locale
                      has — which is the failure this is sized around rather
                      than around English.
                    */
                    className={`tile ${TILE_CLASS[type]} sheen tap-scale relative flex min-h-[104px] w-full min-w-0 flex-col items-start rounded-[20px] p-3.5 text-start`}
                  >
                    {/* The count, out of the label's way (see the file note). */}
                    <span
                      aria-hidden="true"
                      data-type-count
                      className="tile-chip tile-ink absolute end-3 top-3 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums"
                    >
                      {counts[type]}
                    </span>

                    <span
                      aria-hidden="true"
                      data-type-plate
                      className="tile-plate grid h-[46px] w-[46px] place-items-center rounded-[15px]"
                      style={{ color: palette.accent }}
                    >
                      <Icon name={palette.icon} size={1.4} />
                    </span>

                    {/*
                      `overflow-wrap: anywhere`, not `break-words`. The two
                      differ in exactly the case that bit here: `break-word`
                      breaks a long word to avoid overflowing, but does not
                      reduce the element's min-content width — so "Quotation"
                      at 200% text still held the tile 157px wide in a 151px
                      column. `anywhere` does shrink it.
                    */}
                    <span
                      data-type-label
                      className="tile-ink mt-2.5 text-[14px] font-semibold leading-tight [overflow-wrap:anywhere]"
                    >
                      {pluralLabel(profile, type)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {attention.length > 0 && (
            <section className="pt-4" aria-label={strings.home.needsAttention}>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <h2 className="flex-1 text-[12.5px] font-semibold">{strings.home.needsAttention}</h2>
                <span
                  aria-hidden="true"
                  className="rounded-full bg-status-warn-tint px-2 py-0.5 text-[9.5px] font-semibold tabular-nums text-status-warn"
                >
                  {attention.length}
                </span>
              </div>

              <ul className="glass overflow-hidden rounded-[18px]">
                {attention.map((item) => {
                  const overdue = item.kind === 'overdue'
                  return (
                    <li key={item.documentId} className="border-b border-edge/5 last:border-0">
                      <button
                        type="button"
                        onClick={() => onOpenDocument(item.documentId)}
                        className="flex min-h-tap w-full items-center gap-2.5 p-3 text-start"
                      >
                        <span
                          aria-hidden="true"
                          // Tokens, not the prototype's two literal gradients.
                          // A hex reached through an inline style is invisible
                          // to a theme AND to a class scan — which is exactly
                          // the pair of failures the dark-mode sweep exists
                          // to catch, and it caught these.
                          className={`raised-soft grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] ${
                            overdue
                              ? 'bg-status-warn-tint text-status-warn'
                              : 'bg-status-info-tint text-status-info'
                          }`}
                        >
                          <Icon name={overdue ? 'alert-triangle' : 'truck-delivery'} size={0.95} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">
                            {item.reference ??
                              (overdue
                                ? format(strings.home.overdueBy, {
                                    amount:
                                      item.amount === undefined
                                        ? ''
                                        : formatMoney(item.amount),
                                  })
                                : strings.home.inTransit)}
                          </span>
                          {/*
                            The second line, when the screen has one to give.
                            A row with only a reference on it says which
                            record wants attention but not why — and "why" is
                            the whole point of the list (§G).
                          */}
                          {item.detail !== undefined && (
                            <span className="mt-0.5 block truncate text-[10px] opacity-60">
                              {item.detail}
                            </span>
                          )}
                        </span>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] ${
                            overdue
                              ? 'bg-status-warn-tint text-status-warn'
                              : 'bg-status-info-tint text-status-info'
                          }`}
                        >
                          {overdue ? strings.home.chase : strings.home.sign}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
