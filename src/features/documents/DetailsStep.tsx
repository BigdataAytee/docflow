/**
 * Step 1 — Details (§G).
 *
 * "One screen, four compact cards with tinted header strips."
 *
 * The per-type differences §G spells out are the point of this file:
 *  · quotations show no payment method;
 *  · receipts show date paid, linked invoice, method and reference, and NO
 *    due date;
 *  · delivery documents show a delivery address and no money anywhere.
 */

import { useState } from 'react'

import { useCompany } from '../../app/context'
import { partyLabel, signatureCaption } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { Icon, TYPE_PALETTE } from '../../ui'
import { BuilderCard, TinyButton } from './BuilderCard'
import { InlineCalendar } from './InlineCalendar'
import { REFERENCE_MAX, overrideToStore, referenceProblem } from './reference-override'
import { parseIsoDate, todayIso, type DateSlot } from './dateChips'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import type { Customer } from '../../data/repositories'
import type { Payment } from '../../domain/payments/ledger'
import { CustomerPicker } from '../customers/CustomerPicker'
import type { NewCustomer } from '../customers/CustomerSheet'
import type { BilledInvoice } from '../customers/balance'
import type { DocumentDraft } from './builder'
import type { SavedPaymentLink } from '../../domain/payments/links'
import { DocumentPaymentLinks } from './DocumentPaymentLinks'

export interface DetailsStepProps {
  readonly draft: DocumentDraft
  readonly reference: string
  readonly enabledPaymentMethodCount: number
  /** §G's customer card: the list to search, and what the balance chip needs. */
  readonly customers: readonly Customer[]
  readonly invoices: readonly BilledInvoice[]
  readonly payments: readonly Payment[]
  readonly onChange: (patch: Partial<DocumentDraft>) => void
  readonly onAddCustomer: (customer: NewCustomer) => void
  readonly onSetUpPayment: () => void
  readonly onSign: () => void
  /** The drawn signature itself, resolved from the draft's asset id (§G). */
  readonly signatureUrl?: string
  /**
   * §J's payment links, for the + on the document (§G).
   *
   * Absent hides the control entirely — a delivery carries no money and a
   * receipt records one that already happened, so neither has anything to be
   * paid into. The screen above decides that; this one only draws it.
   */
  readonly paymentLinks?: {
    readonly country: string
    readonly defaults: readonly SavedPaymentLink[]
    readonly onDefaults: (links: readonly SavedPaymentLink[]) => void
  }
  /**
   * Today, `YYYY-MM-DD`, in the phone's own calendar.
   *
   * Injected so a test can sit on a fixed date, and defaulted rather than
   * required because every caller would otherwise compute the same thing.
   */
  readonly today?: string
}

function DateField({
  label,
  emptyLabel,
  value,
  locale,
  open,
  accent,
  onToggle,
}: {
  label: string
  /** What the name says when nothing is chosen — "Choose a date". */
  emptyLabel: string
  value: string | undefined
  locale: string
  open: boolean
  accent: string
  onToggle: () => void
}) {
  const parts = parseIsoDate(value)
  const shown =
    parts === null
      ? ''
      : (() => {
          try {
            return new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(parts.y, parts.m - 1, parts.d))
          } catch {
            return value ?? ''
          }
        })()

  return (
    // `min-w-0`: a flex item will not shrink below its content, so two fields
    // side by side pushed the builder past the edge of a 320px phone. Found by
    // the sweeps.
    <span className="block min-w-0 flex-1">
      <span className="mb-1 block text-[9.5px] opacity-55">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        // The label AND the value. "Due" alone does not say what is in it,
        // and an em dash is not something to read aloud — an empty field
        // says what it is for. The name still starts with the visible label,
        // which is what WCAG 2.5.3 is about.
        aria-label={`${label}: ${shown === '' ? emptyLabel : shown}`}
        className="sunken tap-scale flex min-h-tap w-full items-center gap-2 rounded-[10px] px-2.5 text-start"
        style={open ? { borderColor: accent, boxShadow: `0 0 0 3px ${accent}1a` } : undefined}
      >
        <Icon name="calendar" size={0.85} className="shrink-0 opacity-45" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{shown}</span>
      </button>
    </span>
  )
}

type DateKey = 'issueDate' | 'dueDate' | 'validUntil' | 'dispatchDate' | 'expectedDate'

/**
 * The FIRST date field, which is not the same question on every type.
 *
 * A money document asks when it was raised. A DELIVERY asks when the goods
 * go out — §E's `dispatch_date`, and the reference's own branch:
 * `cur==='way' ? dfield(0,'Dispatch') : dfield(0,'Issue date')`.
 *
 * A delivery's `issueDate` still exists; it is set at creation and never
 * shown, because a customer's history sorts on it and a record without one
 * sinks to the bottom of that list whatever the date really was.
 */
function firstDateFor(
  type: DocumentType,
  strings: ReturnType<typeof useCompany>['strings'],
): { key: DateKey; label: string } {
  switch (type) {
    case 'waybill':
      return { key: 'dispatchDate', label: strings.details.dispatch }
    case 'receipt':
      return { key: 'issueDate', label: strings.details.datePaid }
    default:
      return { key: 'issueDate', label: strings.details.issueDate }
  }
}

/** The second date field, which differs per type — and is absent on a receipt. */
function secondDateFor(
  type: DocumentType,
  strings: ReturnType<typeof useCompany>['strings'],
): { key: DateKey; label: string } | null {
  switch (type) {
    case 'invoice':
      return { key: 'dueDate', label: strings.details.dueDate }
    case 'quotation':
      return { key: 'validUntil', label: strings.details.validUntil }
    case 'waybill':
      // When it should ARRIVE. Dispatch is the first slot now (§E).
      return { key: 'expectedDate', label: strings.details.expected }
    case 'receipt':
      // §G: "receipts show date paid … no due date".
      return null
  }
}

export function DetailsStep({
  draft,
  reference,
  enabledPaymentMethodCount,
  customers,
  invoices,
  payments,
  onChange,
  onAddCustomer,
  onSetUpPayment,
  onSign,
  signatureUrl,
  paymentLinks,
  today = todayIso(),
}: DetailsStepProps) {
  const { profile, strings } = useCompany()
  const { accent, tint } = TYPE_PALETTE[draft.type]
  /*
   * §G's pencil. `referenceDraft` is what is being typed; `referenceOverride`
   * on the draft is what has been accepted. Keeping them apart is what lets
   * somebody type a slash, see why it cannot be used, and fix it — rather
   * than having the bad value written to the document as they type.
   */
  const [editingReference, setEditingReference] = useState(false)
  const [referenceDraft, setReferenceDraft] = useState('')
  const referenceIssue =
    editingReference && referenceDraft.trim() !== '' ? referenceProblem(referenceDraft) : null

  /** Accepts what was typed, or leaves the field open on a problem (§K). */
  const commitReference = (): void => {
    if (referenceDraft.trim() !== '' && referenceProblem(referenceDraft) !== null) return
    onChange({
      ...(overrideToStore(referenceDraft) === undefined
        ? { referenceOverride: undefined }
        : { referenceOverride: overrideToStore(referenceDraft) }),
    })
    setEditingReference(false)
  }

  const [openCalendar, setOpenCalendar] = useState<DateSlot | null>(null)
  const first = firstDateFor(draft.type, strings)
  const second = secondDateFor(draft.type, strings)
  const showsMoney = carriesMoney(draft.type)

  return (
    <div className="space-y-3">
      <BuilderCard title={strings.details.numberAndDates} icon="hash" accent={accent}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[9.5px] opacity-55">
              {strings.details.numberLabel}
            </span>
            {/*
              Monospace, because a reference is read CHARACTER BY CHARACTER
              when somebody reads it down a phone — and a proportional 0 next
              to a proportional O is where that goes wrong.
            */}
            {/*
              §G'S PENCIL, which for a long time did nothing at all.

              Editing IN PLACE rather than behind a sheet: the value is one
              short line, the owner is already looking at it, and Rule #1 caps
              this at the smallest thing that works. A sheet would be a screen
              to open and dismiss for a field narrower than the button that
              opens it.
            */}
            {editingReference ? (
              <input
                autoFocus
                value={referenceDraft}
                /*
                 * UPPERCASE AS IT IS TYPED (§G, §M).
                 *
                 * A reference is an identifier a customer reads back over the
                 * phone and a colleague searches for, and `dr-inv-0413` and
                 * `DR-INV-0413` are the same number written two ways — which
                 * is how one document ends up looking like two. Phone
                 * keyboards start lower case, so left alone this is what
                 * everybody would get.
                 *
                 * Done on the way IN rather than on the way out, so the owner
                 * watches it happen instead of having their typing silently
                 * rewritten when they look away.
                 */
                onChange={(event) => setReferenceDraft(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onBlur={commitReference}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitReference()
                  if (event.key === 'Escape') setEditingReference(false)
                }}
                aria-label={strings.details.editReference}
                aria-invalid={referenceIssue !== null}
                className="sunken min-h-tap w-full rounded-lg px-2 font-mono text-xs font-semibold"
              />
            ) : (
              /*
                THE OWNER'S OWN NUMBER, once they have set one.
                
                This printed `reference` unconditionally — the PROVISIONAL
                "INV-…" the app will mint at issue. So somebody typed
                DR-INV-0413, pressed Enter, and watched the field go back to
                "INV-…": the override was stored, nothing said so, and the
                pencil was indistinguishable from the inert button it used to
                be. The write was the easy half; this is the half that makes
                it visible.

                `referenceOverride` only exists on a draft, and at issue it
                becomes the reference — so showing it here is showing what
                this document will actually be called, not a preview of a
                guess.
              */
              /*
                MUTED WHILE IT IS ONLY AN OFFER, solid once it is theirs.

                The list page and the customer's history show this same
                number now, muted the same way, so a draft looks like a
                draft wherever somebody meets it. Here the mute does a
                second job: it is the difference between "this is what you
                will get" and "this is what you typed", which is the one
                piece of feedback the pencil could not otherwise give.
              */
              <span
                {...(draft.referenceOverride === undefined
                  ? { 'data-provisional': 'true' }
                  : {})}
                className={`block truncate font-mono text-xs ${
                  draft.referenceOverride === undefined
                    ? 'font-medium opacity-55'
                    : 'font-semibold'
                }`}
              >
                {draft.referenceOverride ?? reference}
              </span>
            )}
          </span>
          <TinyButton
            label={strings.details.editReference}
            icon="pencil"
            accent={accent}
            tint={tint}
            onClick={() => {
              setReferenceDraft(draft.referenceOverride ?? '')
              setEditingReference(true)
            }}
          />
        </div>

        {/*
          Said beside the field, while they are still in it (§K). The rule is
          about what SURVIVES: a reference goes into a filename and into a
          shared link, so a slash breaks both and they find out here rather
          than from a link that will not open.
        */}
        {referenceIssue !== null && (
          <p className="mt-1 text-[11px] font-medium text-status-warn" role="alert">
            {referenceIssue === 'too_long'
              ? format(strings.details.referenceTooLong, { count: REFERENCE_MAX })
              : strings.details.referenceUnusable}
          </p>
        )}
        <div className="flex gap-2.5">
          <DateField
            label={first.label}
            emptyLabel={strings.details.chooseDate}
            value={draft[first.key]}
            locale={profile.locale}
            accent={accent}
            open={openCalendar === 'first'}
            onToggle={() => setOpenCalendar(openCalendar === 'first' ? null : 'first')}
          />
          {second !== null && (
            <DateField
              label={second.label}
              emptyLabel={strings.details.chooseDate}
              value={draft[second.key]}
              locale={profile.locale}
              accent={accent}
              open={openCalendar === 'second'}
              onToggle={() => setOpenCalendar(openCalendar === 'second' ? null : 'second')}
            />
          )}
        </div>

        {/*
          One calendar, under the pair — never two open at once. The prototype
          does the same, and it is the only arrangement that fits: two month
          grids side by side on a 360px phone are two unusable month grids.
        */}
        {openCalendar !== null && (
          <InlineCalendar
            type={draft.type}
            slot={openCalendar}
            value={(openCalendar === 'first' ? draft[first.key] : draft[second?.key ?? first.key]) ?? ''}
            // What the second slot's chips count FROM — a due date is "7 days
            // after the date above", and on a delivery an expected arrival is
            // counted from the dispatch. Whatever the first slot holds.
            firstDate={draft[first.key] ?? ''}
            today={today}
            accent={accent}
            onPick={(picked) => {
              onChange(
                openCalendar === 'first' || second === null
                  ? { [first.key]: picked }
                  : { [second.key]: picked },
              )
              setOpenCalendar(null)
            }}
          />
        )}
      </BuilderCard>

      {/* The title is the localised party word — Bill to / Deliver to / Client /
          Received from — resolved through the locale layer (§D, Rule #4). */}
      <BuilderCard title={partyLabel(profile, draft.type)} icon="user" accent={accent}>
        <CustomerPicker
          customers={customers}
          {...(draft.customerId === undefined ? {} : { selectedId: draft.customerId })}
          invoices={invoices}
          payments={payments}
          onSelect={(id) => onChange({ customerId: id })}
          onAdd={onAddCustomer}
          showBalance={showsMoney}
        />
        {draft.type === 'waybill' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium opacity-70">
              {strings.details.deliveryAddress}
            </span>
            <input
              value={draft.deliveryAddress ?? ''}
              onChange={(event) => onChange({ deliveryAddress: event.target.value })}
              aria-label={strings.details.deliveryAddress}
              className="sunken min-h-tap w-full rounded-lg px-3 text-sm"
            />
          </label>
        )}
      </BuilderCard>

      {/*
        §J: payment setup is never shown on a quotation, and a delivery
        document carries no money at all — so neither gets this card.

        NOR A RECEIPT, and that one was wrong on the paper as well as on the
        screen. A receipt prints no payment box (§I) — it is evidence the money
        already arrived — so an amber "Set up payment" on one was asking the
        owner to fix something that document will never show. §N's rule is that
        an unavailable capability is SAID; this was the opposite, a demand for
        a capability nothing here needs.
      */}
      {showsMoney && draft.type !== 'quotation' && draft.type !== 'receipt' && (
        <BuilderCard title={strings.details.currencyAndPayment} icon="credit-card" accent={accent}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{draft.currency}</span>
            {enabledPaymentMethodCount > 0 ? (
              <span className="rounded-full bg-status-good-tint px-3 py-1 text-xs font-semibold text-status-good">
                {format(strings.details.paymentReady, { count: enabledPaymentMethodCount })}
              </span>
            ) : (
              <button
                type="button"
                onClick={onSetUpPayment}
                className="min-h-tap rounded-full bg-status-warn-tint px-3 text-xs font-semibold text-status-warn"
              >
                {strings.details.setUpPayment}
              </button>
            )}
          </div>

          {/*
            §J'S + , ON THE DOCUMENT.

            The card already says whether this invoice can be paid; this is
            how to change the answer without leaving it. Inside the same card
            rather than as a new one: it is the same subject, and Rule #1
            caps a mid-invoice afterthought at a button rather than a section.
          */}
          {paymentLinks !== undefined && (
            <div className="mt-2">
              <DocumentPaymentLinks
                country={paymentLinks.country}
                defaults={paymentLinks.defaults}
                own={draft.paymentLinks}
                onDocument={(links) => onChange({ paymentLinks: links })}
                onDefaults={paymentLinks.onDefaults}
              />
            </div>
          )}
        </BuilderCard>
      )}

      {/*
        Titled by the per-type caption, not the word "Signature". It is the
        same caption that prints under the line (§I), so the builder says what
        the document will say — and a delivery's "DISPATCHED BY" is a
        different promise from an invoice's "AUTHORISED SIGNATURE".
      */}
      <BuilderCard title={signatureCaption(profile, draft.type)} icon="signature" accent={accent}>
        {/*
          §G: "a dashed tap-to-sign box, OR the drawn signature". A tick is
          neither — it says a signature exists without showing which one, and
          the owner cannot tell a good mark from a slipped finger without
          reopening the pad.
        */}
        <button
          type="button"
          onClick={onSign}
          aria-label={signatureUrl === undefined ? strings.details.tapToSign : strings.signature.title}
          className="flex min-h-[72px] w-full items-center justify-center rounded-lg border-2 border-dashed border-ink/25 p-2 text-sm opacity-70"
        >
          {signatureUrl === undefined ? (
            strings.details.tapToSign
          ) : (
            <img src={signatureUrl} alt={strings.signature.drawn} className="max-h-14 w-auto" />
          )}
        </button>
      </BuilderCard>
    </div>
  )
}
