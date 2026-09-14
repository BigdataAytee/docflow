/**
 * Home (§G) — "the only place all four types appear together".
 *
 * Exactly two stat cards, four type tiles, a search field, and the two or
 * three things that want doing. The connectivity pill is truthful: it is
 * driven by real connection plus pending work, never by a simulated toggle.
 *
 * §F's header note is the one thing here that is a judgement rather than a
 * measurement: "noticeably blue but lighter than the original deep navy,
 * blending its lower edge into the page". So the gradient stops at the mid
 * blue instead of running down to `#1a2a9e`, and its last few pixels fade to
 * the page colour — which is what makes the stat cards read as sitting in the
 * header's light rather than parked on a band that ends abruptly.
 *
 * The Voice and Scan controls §G places here render only when this screen is
 * given something for them to DO. They are absent by default, and that is a
 * deliberate deviation from the drawing: §N is explicit that an unavailable
 * capability is stated plainly rather than dressed up, and a round microphone
 * that opens nothing is the dressed-up version. The slot is here, in the
 * place and shape §G draws; Phase 6 supplies the handlers and they appear.
 */

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { label as typeLabel, pluralLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { ConnectivityPill, Icon, StatusBadge, TYPE_PALETTE } from '../../ui'
import { DOCUMENT_TYPES, type DocumentType } from '../../domain/documents/types'
import type { CurrencyCode, Money } from '../../domain/money/money'
import { formatMoney } from '../customers/formatMoney'
import type { AttentionItem } from './stats'

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
  /** §G's two round controls. Rendered only when there is something behind them. */
  readonly onVoice?: () => void
  readonly onScan?: () => void
  /**
   * §G: "typing replaces the body with results". When this is present the
   * tiles and the attention list step aside for it — the header, the stat
   * cards and the field itself stay, so the way back is always on screen.
   */
  readonly searchQuery?: string
  readonly results?: ReactNode
}

function greeting(now: Date, strings: ReturnType<typeof useCompany>['strings']): string {
  const hour = now.getHours()
  if (hour < 12) return strings.home.greetingMorning
  if (hour < 17) return strings.home.greetingAfternoon
  return strings.home.greetingEvening
}

function StatCard({
  title,
  amounts,
  emptyLabel,
}: {
  title: string
  amounts: ReadonlyMap<CurrencyCode, Money>
  emptyLabel: string
}) {
  const entries = [...amounts.entries()].filter(([, amount]) => amount.minor !== 0)

  return (
    <section
      // `min-w-0` because a flex item defaults to `min-width: auto` and will
      // not shrink below its content — so at 200% text these two cards pushed
      // the page 208px wider than the phone. Found by the large-text sweep.
      className="glass sheen min-w-0 flex-1 rounded-2xl p-4"
      aria-label={title}
    >
      <p className="text-xs font-medium opacity-70">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-lg font-bold opacity-50">{emptyLabel}</p>
      ) : (
        // One line per currency — never a combined figure (§G, §V).
        entries.map(([currency, amount]) => (
          <p key={currency} className="mt-1 text-lg font-bold tabular-nums">
            {formatMoney(amount)}
          </p>
        ))
      )}
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
      <Icon name="photo" size={1.1} className="opacity-45" />
    ) : (
      <img src={logoUrl} alt="" className="h-full w-full object-contain" />
    )

  const box = 'grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-on-accent p-1.5 text-ink'

  // Inert when there is nowhere to go — and then not a button at all, rather
  // than a button that does nothing when pressed.
  if (onAdd === undefined) {
    return (
      <span aria-hidden="true" className={box}>
        {inner}
      </span>
    )
  }

  return (
    <button type="button" onClick={onAdd} aria-label={label} className={`${box} raised tap-scale`}>
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
  searchQuery,
  results,
}: HomeProps) {
  const { profile, strings } = useCompany()

  return (
    <div className="pb-28">
      <header
        className="sheen-strong relative overflow-hidden rounded-b-3xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-white"
        // §F: noticeably blue, lighter than the original deep navy. The deep
        // stop is gone; the darkest point is the mid blue, at the top corner
        // furthest from the content.
        style={{ backgroundImage: 'linear-gradient(155deg, #5b70f2 0%, #4a60ee 42%, #2b3fd6 100%)' }}
      >
        <div className="flex items-center gap-3">
          <LogoHolder
            {...(logoUrl === undefined ? {} : { logoUrl })}
            label={strings.home.addLogo}
            {...(onAddLogo === undefined ? {} : { onAdd: onAddLogo })}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{businessName}</p>
            {/*
              §G's "Tap to add your logo until one is set". It is a hint for
              the control beside it, which already carries that same sentence
              as its name — so this copy is hidden from a reader rather than
              announced twice.
            */}
            {logoUrl === undefined && (
              <p aria-hidden="true" className="truncate text-[11px] opacity-75">
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
              className="tap-scale grid min-h-tap min-w-tap shrink-0 place-items-center rounded-full opacity-85"
            >
              <Icon name="logout" size={1.15} />
            </button>
          )}
        </div>

        {/*
          The page's h1. It was a paragraph, so Home — the app's first screen —
          opened with a level-2 heading and nothing above it, and a reader
          jumping by heading could not tell where the page began. The biggest
          line on the screen is now also the biggest line in the outline.
        */}
        <h1 className="mt-5 text-xl font-bold">
          {greeting(now, strings)}
          {userName === '' ? '' : `, ${userName}`}
        </h1>
        <p className="mt-1 text-sm opacity-80">{strings.home.greetingLine}</p>

        {/*
          §F's "blending its lower edge into the page". Decorative, and it has
          to sit above the sheen's stacking context, hence the explicit z.
        */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-10 bg-gradient-to-b from-transparent to-page opacity-90"
        />
      </header>

      <div className="relative z-[2] -mt-7 flex gap-3 px-4">
        <StatCard
          title={strings.home.outstanding}
          amounts={outstanding}
          emptyLabel={strings.home.nothingOutstanding}
        />
        <StatCard
          title={strings.home.receivedThisMonth}
          amounts={received}
          emptyLabel={strings.home.nothingReceived}
        />
      </div>

      <div className="flex items-center gap-3 px-4 pt-4">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{strings.home.searchEverything}</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center opacity-45"
          >
            <Icon name="search" size={1.05} />
          </span>
          <input
            type="search"
            value={searchQuery ?? ''}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={strings.home.searchEverything}
            aria-label={strings.home.searchEverything}
            className="recessed min-h-tap w-full rounded-full ps-10 pe-4 text-sm"
          />
        </label>

        {/* §G's two round controls, when Phase 6 has given them a job. */}
        {onVoice !== undefined && (
          <button
            type="button"
            onClick={onVoice}
            aria-label={strings.common.voice}
            className="glass raised tap-scale grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand"
          >
            <Icon name="microphone" size={1.15} />
          </button>
        )}
        {onScan !== undefined && (
          <button
            type="button"
            onClick={onScan}
            aria-label={strings.common.scan}
            className="glass raised tap-scale grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand"
          >
            <Icon name="camera" size={1.15} />
          </button>
        )}
      </div>

      {/* §G: typing replaces the body. The header, the stat cards and the
          field above stay put, so there is always a way back. */}
      {results ?? (
        <>
          <ul className="grid grid-cols-2 gap-3 px-4 pt-4">
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
                    // Read aloud, the spans below run together as "Invoice 3",
                    // which sounds like a reference number. The count line
                    // already says it properly in every language.
                    aria-label={format(strings.lists.countLine, {
                      count: counts[type],
                      label: pluralLabel(profile, type),
                    })}
                    className="sheen tap-scale flex w-full min-w-0 flex-col items-start gap-2 rounded-2xl p-4 text-start text-white"
                    style={{
                      backgroundImage: `linear-gradient(150deg, ${palette.accent}, ${palette.deep})`,
                      // §F's "coloured shadow" — the tile's own accent at
                      // depth, plus the contact shadow every raised surface
                      // gets, so it sits above the page rather than on it.
                      boxShadow: `0 14px 26px -14px ${palette.accent}, 0 2px 6px -2px rgb(20 28 74 / 0.22), inset 0 1px 0 rgb(255 255 255 / 0.22)`,
                    }}
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <Icon name={palette.icon} size={1.5} className="opacity-90" />
                      {/* §G's count badge. */}
                      <span
                        aria-hidden="true"
                        className="shrink-0 rounded-full bg-on-accent/20 px-2 py-0.5 text-xs font-bold tabular-nums"
                      >
                        {counts[type]}
                      </span>
                    </span>
                    {/*
                      `overflow-wrap: anywhere`, not `break-words`. The two
                      differ in exactly the case that bit here: `break-word`
                      breaks a long word to avoid overflowing, but does not
                      reduce the element's min-content width — so "Quotation"
                      at 200% text still held the tile 157px wide in a 151px
                      column. `anywhere` does shrink it.
                    */}
                    <span className="text-sm font-bold leading-tight [overflow-wrap:anywhere]">
                      {typeLabel(profile, type)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {attention.length > 0 && (
            <section className="px-4 pt-6" aria-label={strings.home.needsAttention}>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Icon name="alert-triangle" size={1} className="text-status-warn" />
                {strings.home.needsAttention}
              </h2>
              <ul className="mt-2 space-y-2">
                {attention.map((item) => (
                  <li key={item.documentId}>
                    <button
                      type="button"
                      onClick={() => onOpenDocument(item.documentId)}
                      className="glass tap-scale flex min-h-tap w-full items-center gap-3 rounded-2xl p-3 text-start"
                    >
                      <span className="flex-1">
                        <StatusBadge
                          status={item.kind === 'overdue' ? 'overdue' : 'in_transit'}
                          label={
                            item.kind === 'overdue'
                              ? format(strings.home.overdueBy, {
                                  amount: item.amount === undefined ? '' : formatMoney(item.amount),
                                })
                              : strings.home.inTransit
                          }
                        />
                      </span>
                      <span className="raised shrink-0 rounded-full bg-page px-3 py-1 text-xs font-semibold">
                        {item.kind === 'overdue' ? strings.home.chase : strings.home.sign}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
