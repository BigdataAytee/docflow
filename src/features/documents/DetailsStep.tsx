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

import type { ReactNode } from 'react'

import { useCompany } from '../../app/context'
import { partyLabel } from '../../domain/locale/profile'
import { format } from '../../domain/locale/data/strings'
import { TYPE_PALETTE } from '../../ui'
import { carriesMoney, type DocumentType } from '../../domain/documents/types'
import type { Customer } from '../../data/repositories'
import type { Payment } from '../../domain/payments/ledger'
import { CustomerPicker } from '../customers/CustomerPicker'
import type { NewCustomer } from '../customers/CustomerSheet'
import type { BilledInvoice } from '../customers/balance'
import type { DocumentDraft } from './builder'

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
}

function Card({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface/85">
      {/*
        h2, not h3. The only heading above these cards is the builder's h1, so
        an h3 leaves a reader jumping by heading level with nothing at level 2
        and no way to tell where the step begins. Found by the screen-reader
        sweep, which reads Chromium's accessibility tree rather than the DOM.
      */}
      <h2
        className="px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.12em]"
        style={{ backgroundColor: `${accent}1a`, color: accent }}
      >
        {title}
      </h2>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
}) {
  return (
    // `min-w-0`: a date input has a wide intrinsic minimum, and a flex item
    // will not shrink below its content, so two side by side pushed the
    // builder past the edge of a 320px phone. Found by the sweeps.
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-medium opacity-70">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
      />
    </label>
  )
}

/** The second date field, which differs per type — and is absent on a receipt. */
function secondDateFor(
  type: DocumentType,
  strings: ReturnType<typeof useCompany>['strings'],
): { key: 'dueDate' | 'validUntil' | 'dispatchDate'; label: string } | null {
  switch (type) {
    case 'invoice':
      return { key: 'dueDate', label: strings.details.dueDate }
    case 'quotation':
      return { key: 'validUntil', label: strings.details.validUntil }
    case 'waybill':
      return { key: 'dispatchDate', label: strings.details.dispatchDate }
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
}: DetailsStepProps) {
  const { profile, strings } = useCompany()
  const accent = TYPE_PALETTE[draft.type].accent
  const second = secondDateFor(draft.type, strings)
  const showsMoney = carriesMoney(draft.type)

  return (
    <div className="space-y-3">
      <Card title={strings.details.numberAndDates} accent={accent}>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-semibold tabular-nums">{reference}</span>
          <button
            type="button"
            aria-label={strings.details.editReference}
            className="min-h-tap min-w-tap rounded-full text-ink/60"
          >
            ✎
          </button>
        </div>
        <div className="flex gap-3">
          <DateField
            label={draft.type === 'receipt' ? strings.details.datePaid : strings.details.issueDate}
            value={draft.issueDate}
            onChange={(value) => onChange({ issueDate: value })}
          />
          {second !== null && (
            <DateField
              label={second.label}
              value={draft[second.key]}
              onChange={(value) => onChange({ [second.key]: value })}
            />
          )}
        </div>
      </Card>

      {/* The title is the localised party word — Bill to / Deliver to / Client /
          Received from — resolved through the locale layer (§D, Rule #4). */}
      <Card title={partyLabel(profile, draft.type)} accent={accent}>
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
              className="min-h-tap w-full rounded-lg bg-page px-3 text-sm shadow-inner"
            />
          </label>
        )}
      </Card>

      {/* §J: payment setup is never shown on a quotation, and a delivery
          document carries no money at all — so neither gets this card. */}
      {showsMoney && draft.type !== 'quotation' && (
        <Card title={strings.details.currencyAndPayment} accent={accent}>
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
        </Card>
      )}

      <Card title={strings.details.signature} accent={accent}>
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
      </Card>
    </div>
  )
}
